"""Rebuild Dragonsgate from the source raster and authored survey.
Run: python scripts/dragonsgate/rebuild.py (Pillow, NumPy, SciPy).
"""
import hashlib
import json
from pathlib import Path
import subprocess
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from scipy.spatial import cKDTree
from raster import polygon_mask, outline, simplify, lane_paths
from routes import align_routes

ROOT = Path(__file__).resolve().parents[2]
survey = json.loads((ROOT/'sources/dragonsgate/survey.json').read_text())
rgb = np.array(Image.open(ROOT/'sources/dragonsgate.png').convert('RGB'))
height, width = rgb.shape[:2]
map_data = survey['metadata'] | {'districts':survey['districts'], 'locations':[]}
locations = map_data['locations']
# Map-local home grammar leaves the released v2 catalog unchanged.
home = json.loads(subprocess.check_output(['node','--input-type=module','-e',
    "import {types} from './public/js/generation/catalog-v2.js'; console.log(JSON.stringify(types.home))"],cwd=ROOT))
home['tables'].update(name=['{surname} House','{surnamePossessive} Home','{firstPossessive} House',
    '{surname} & {partnerSurname} House','{surname} Household','{houseNumber} {street}'],
    description=['{displayName} is a {wealth} household in {district}, {setting}. {detail} {history}',
    'The residents of {displayName} live at {address} in {district}. {detail} {history}'])
map_data['generator']['catalog']={'types':{'home':home}}
district_masks = {d['id']:polygon_mask((width,height),d['boundaries']) for d in survey['districts']}


def in_ring(points,x,y):
    inside=False
    for i,(ax,ay) in enumerate(points):
        bx,by=points[i-1]
        cross=(x-ax)*(by-ay)-(y-ay)*(bx-ax)
        if abs(cross)<1e-8 and min(ax,bx)<=x<=max(ax,bx) and min(ay,by)<=y<=max(ay,by):
            return True
        if (ay>y)!=(by>y) and x<(bx-ax)*(y-ay)/(by-ay)+ax:
            inside=not inside
    return inside


def actual_district(x,y):
    for d in sorted(survey['districts'],key=lambda d:d['id']=='outer-fields'):
        if any(in_ring(shape['points'],x,y) for shape in d['boundaries']):
            return d['id']
    return None


def district_at(x,y):
    return actual_district(x,y) or min(survey['districts'],key=lambda d:(x-d['label']['x'])**2+(y-d['label']['y'])**2)['id']


def add(id, category, type, shape, name=None, description=None, xy=None, **extra):
    if xy is None:
        if shape['kind']=='polygon':
            points=np.array(shape['points']); xy=points.mean(axis=0).round(1).tolist()
        else:
            xy=shape['points'][len(shape['points'])//2]
    p={'id':id,'category':category,'type':type,'district':district_at(*xy),'x':xy[0],'y':xy[1],'shape':shape}
    if name or description:
        p['overrides']={k:v for k,v in [('name',name),('description',description)] if v}
    p.update(extra);locations.append(p)
    return p


# Map water from the actual colored sea pixels, retaining islands as holes.
sea=(rgb[:,:,2].astype(int)-rgb[:,:,0]>5)&(rgb[:,:,0]>65)&(rgb[:,:,0]<200)
sea=ndi.binary_closing(sea,iterations=1)
sea_labels,_=ndi.label(sea)
sea_areas=np.bincount(sea_labels.ravel());sea_areas[0]=0
sea_region=sea_labels==np.argmax(sea_areas)
loops=outline(sea_region,all_loops=True,tolerance=.9)
add('water-shattered-sea','water','sea',{'kind':'polygon','points':loops[0],'holes':loops[1:]},
    'The Shattered Sea','The coastal sea surrounds Dragonsgate Island and the watch isles. Bays and channels have their own named water areas.',xy=[65,215],labelMinScale=.5)
land_labels, land_count=ndi.label(~sea)
land_areas=np.bincount(land_labels.ravel())
for label,slices in enumerate(ndi.find_objects(land_labels),1):
    if slices is None or land_areas[label]<18:
        continue
    sy,sx=slices; area=int(land_areas[label]); component=land_labels[slices]==label
    if area>500000: # Mainland meets the image boundary.
        continue
    points=outline(component,sx.start,sy.start,1 if area>1000 else .7)
    if len(points)<3:
        continue
    x=float(np.where(component)[1].mean()+sx.start);y=float(np.where(component)[0].mean()+sy.start)
    if area>100000:
        id='terrain-city-island'; name='Dragonsgate Island';xy=[405,190]
    else:
        id=f'terrain-islet-{int(x):03}-{int(y):03}';name=None;xy=[round(x,1),round(y,1)]
        for authored in survey.get('islandNames',[]):
            if np.hypot(x-authored['x'],y-authored['y'])<25:
                name=authored['name'];break
    add(id,'terrain','island',{'kind':'polygon','points':points},name,xy=xy)

for f in survey['features']:
    add(**f)
align_routes(survey['roads'],rgb)
for r in survey['roads']:
    add(r['id'],'street',r['type'],{'kind':'polyline','width':r['width'],'points':r['points']},r['name'])

# Black filled roof footprints. Open tree outlines are rejected by their low fill ratio.
dark=np.max(rgb,axis=2)<95
roof_labels,_=ndi.label(dark)
roof_areas=np.bincount(roof_labels.ravel())
landmark_mask=Image.new('1',(width,height));draw=ImageDraw.Draw(landmark_mask)
for authored in survey['landmarks']:
    p=dict(authored);x,y,w,h=p['bounds'];p.update(x=round(x+w/2,1),y=round(y+h/2,1))
    p['district']=district_at(p['x'],p['y']);locations.append(p)
    draw.rectangle([x-1,y-1,x+w+1,y+h+1],fill=1)
landmark_mask=np.array(landmark_mask,dtype=bool)
city=np.zeros((height,width),dtype=bool)
for id,mask in district_masks.items():
    if id not in ['outer-fields','watch-isles']:
        city|=mask
# Restrict automatic streets to white corridors connected to the public road network.
exclusions=survey.get('laneExclusions',[])+[f['shape'] for f in survey['features'] if f['category']=='terrain' and f['type'] in ['wood','field']]
exclude_lanes=polygon_mask((width,height),exclusions)
white=(np.min(rgb,axis=2)>165)&((np.max(rgb,axis=2)-np.min(rgb,axis=2))<35)&city&~landmark_mask&~exclude_lanes
white_labels,_=ndi.label(white)
white_areas=np.bincount(white_labels.ravel());white=white&(white_areas[white_labels]>600)
principal=Image.new('1',(width,height));draw=ImageDraw.Draw(principal)
for r in survey['roads']:
    draw.line([tuple(p) for p in r['points']],fill=1,width=5)
principal_distance=ndi.distance_transform_edt(~np.array(principal,dtype=bool))
paths=lane_paths(white)
for path in paths:
    values=[principal_distance[y,x] for x,y in path]
    if np.median(values)<3:
        continue
    points=simplify(path,.7)
    # Keep corridor selection narrow enough to avoid neighboring roofs.
    x,y=path[len(path)//2];id=f'lane-{x:03}-{y:04}'
    if any(p['id']==id for p in locations):
        id+='-'+hashlib.sha256(str(points).encode()).hexdigest()[:6]
    add(id,'street','alley' if len(path)<20 else 'lane',{'kind':'polyline','width':2,'points':points},xy=[x,y],labelMinScale=2.5)

trades=[('shop','grocer'),('shop','bakery'),('shop','tailor'),('shop','apothecary'),('shop','fishmonger'),('shop','bookseller'),('shop','chandler'),('shop','outfitter'),('shop','wine_merchant'),('shop','stationer'),('shop','cheesemonger'),('shop','jeweler'),('shop','haberdasher'),('shop','spice_seller'),('shop','pawnbroker'),('shop','arcane')]
crafts=[('workshop',t) for t in ['blacksmith','carpenter','cooper','potter','shoemaker','woodcarver','tinker','stonemason','locksmith','glassworker','sailmaker','fletcher','silversmith']]
for label,slices in enumerate(ndi.find_objects(roof_labels),1):
    if slices is None:
        continue
    sy,sx=slices;w=sx.stop-sx.start;h=sy.stop-sy.start;area=int(roof_areas[label])
    if not (7<=area<=1600 and min(w,h)>=2 and max(w,h)<=65 and area/(w*h)>=.48 and max(w,h)/min(w,h)<=7):
        continue
    component=roof_labels[slices]==label
    ys,xs=np.where(component);x=round(float(xs.mean()+sx.start),1);y=round(float(ys.mean()+sy.start),1)
    if landmark_mask[int(y),int(x)] or np.any(landmark_mask[slices]&component):
        continue
    # Anchors are actual roof pixels, not centers of bounding boxes over open yards.
    i=int(np.argmin((xs+sx.start-x)**2+(ys+sy.start-y)**2));x=int(xs[i]+sx.start);y=int(ys[i]+sy.start)
    if not actual_district(x+.5,y+.5):
        candidates=sorted(zip(xs+sx.start,ys+sy.start),key=lambda q:(q[0]-x)**2+(q[1]-y)**2)
        candidate=next(((int(px),int(py)) for px,py in candidates if actual_district(float(px)+.5,float(py)+.5)),None)
        if candidate is None:
            continue
        x,y=candidate
    x+=.5;y+=.5
    seed=int(hashlib.sha256(f'roof:{sx.start}:{sy.start}'.encode()).hexdigest()[:12],16)
    roll=seed%1000;district=district_at(x,y)
    coastal=district in ['north-quays','southbank','harborward','southwater']
    if roll<780:category,type='home','home'
    elif roll<910:category,type=trades[(seed//1000)%len(trades)]
    elif roll<975:category,type=crafts[(seed//1000)%len(crafts)]
    elif roll<989:category,type='tavern','tavern'
    elif roll<995:category,type='guild','guild'
    else:category,type='temple','temple'
    if coastal and category=='workshop':type=['cooper','sailmaker','carpenter','blacksmith'][seed%4]
    if district=='outer-fields' and roll<920:category,type='home','home'
    p={'id':f'roof-{sx.start:03}-{sy.start:04}','category':category,'type':type,'district':district,'x':x,'y':y,'generation':{'demographics':{'population':2+seed%7}}}
    if max(w,h)>8:
        points=outline(component,sx.start,sy.start,.45)
        if len(points)>=3:p['shape']={'kind':'polygon','points':points}
        else:p['bounds']=[sx.start,sy.start,w,h]
    else:p['bounds']=[sx.start,sy.start,w,h]
    locations.append(p)

# Saved, deterministic references: roads are chosen within the same land district.
roads=[p for p in locations if p['category']=='street']
water=[p for p in locations if p['category']=='water']

def distance(p, line):
    points=np.array(line['shape']['points']);a=points[:-1];b=points[1:];delta=b-a
    t=np.clip(np.sum((np.array([p['x'],p['y']])-a)*delta,axis=1)/np.maximum(np.sum(delta*delta,axis=1),1e-8),0,1)
    return float(np.min(np.linalg.norm(np.array([p['x'],p['y']])-(a+t[:,None]*delta),axis=1)))

by_district={}
for d in survey['districts']:
    local=[p for p in roads if p['district']==d['id']] or roads
    samples=[];owners=[]
    for road in local:
        points=road.get('shape',{}).get('points')
        if not points:
            points=[[road['x'],road['y']]]*2
        for a,b in zip(points,points[1:]):
            for t in np.linspace(0,1,max(2,int(np.linalg.norm(np.array(a)-b)/2)+1)):
                samples.append(np.array(a)*(1-t)+np.array(b)*t);owners.append(road)
    by_district[d['id']]=(cKDTree(samples),owners)
for p in locations:
    if p['category'] in ['street','water','terrain']:
        continue
    tree,owners=by_district[p['district']]
    nearest=owners[tree.query([p['x'],p['y']])[1]]
    if p.get('featured'):
        named=[r for r in roads if r.get('overrides',{}).get('name') and r['district']==p['district'] and r.get('shape',{}).get('kind')=='polyline']
        if named: nearest=min(named,key=lambda r:distance(p,r))
    p['context']={'street':nearest['id']}
    if p['district'] in ['crown-hill','temple-heights','north-quays','old-town','lantern-ward','southwater']:
        p['context']['terrain']='terrain-city-island'
    if p['district'] in ['north-quays','southwater','southbank','harborward','eastbank','watch-isles'] and water:
        nearest_water=min(water,key=lambda r:(r['x']-p['x'])**2+(r['y']-p['y'])**2)
        if np.hypot(nearest_water['x']-p['x'],nearest_water['y']-p['y'])<130:
            p['context']['water']=nearest_water['id']
head=json.dumps({k:v for k,v in map_data.items() if k!='locations'},indent=2)[:-2]
(ROOT/'public/data/maps/dragonsgate.json').write_text(head+',\n  "locations": [\n'+',\n'.join('    '+json.dumps(p,separators=(',',':'),default=lambda n:n.item()) for p in locations)+'\n  ]\n}\n')
from collections import Counter
print(json.dumps({'total':len(locations),'categories':dict(Counter(p['category'] for p in locations))},indent=2))
