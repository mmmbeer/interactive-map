"""Rebuild Grayhaven from its high-resolution raster and authored survey.

Authoring dependencies: Pillow, NumPy, SciPy, OpenCV, scikit-image, Shapely.
The browser remains dependency-free. No previous generated map is read.
"""
import hashlib
import json
from collections import Counter
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from scipy.spatial import cKDTree
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union
from raster import water_and_land, districts, geometry, shapes, street_mask, network_paths, parcels, pier_shapes
from routes import align_routes
from roofs import roof_candidates

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'sources/grayhaven/survey.json'
survey_bytes=SOURCE.read_bytes()
survey=json.loads(survey_bytes)
rgb=np.array(Image.open(ROOT/survey['image']).convert('RGB'))
gray=cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY);height,width=gray.shape
scale=width/survey['inspectionGrid'][0]
assert height/survey['inspectionGrid'][1]==scale
m=survey['metadata'] | {'width':width,'height':height,'locations':[]}
places=m['locations']
sea,water_shapes,land=water_and_land(rgb)
m['districts'],cells=districts(survey,land,scale)
district_geoms={d['id']:unary_union([geometry(s) for s in d['boundaries']]) for d in m['districts']}


def district_at(x,y):
    point=Point(x,y)
    return next((id for id,g in district_geoms.items() if g.covers(point)),None)


def add(id,category,type,shape,xy=None,name=None,description=None,**extra):
    if xy is None:
        if shape['kind']=='polygon':
            p=geometry(shape).representative_point();xy=[p.x,p.y]
        else:
            xy=shape['points'][len(shape['points'])//2]
    x,y=[round(float(v),2) for v in xy]
    district=district_at(x,y)
    if not district:
        if category!='water':
            # A shoreline deck may fall just outside a simplified coastal ring.
            closest=min(district_geoms,key=lambda id:district_geoms[id].distance(Point(x,y)))
            if district_geoms[closest].distance(Point(x,y))>4:
                raise ValueError(f'{id}: anchor has no land district at {x},{y}')
            district=closest
        else:
            district=min(district_geoms,key=lambda id:district_geoms[id].distance(Point(x,y)))
    p={'id':id,'category':category,'type':type,'district':district,'x':x,'y':y,'shape':shape,**extra}
    if name or description:
        p['overrides']={k:v for k,v in [('name',name),('description',description)] if v}
    places.append(p);return p


# Color-traced water excludes the actual shoreline, piers and breakwater.
for s in sorted(water_shapes,key=lambda s:-geometry(s).area):
    g=geometry(s);center=g.representative_point()
    north=center.y<height*.35 and center.x<width*.65
    id='north-bay' if north else ('gray-sea' if g.area>300000 else 'harbor-basin')
    if any(p['id']==id for p in places):
        id='westhaven-inlet'
    add(id,'water','bay' if north else 'sea' if id=='gray-sea' else 'bay',s,
        name=('Westhaven Inlet' if id=='westhaven-inlet' else 'North Bay') if north else 'The Gray Sea' if id=='gray-sea' else 'Grayhaven Harbor',labelMinScale=.25)

mask=street_mask(gray,survey['roads'],scale)
field_places,missing_parcels=parcels(gray,survey,mask,scale)
field_mask=np.zeros(gray.shape,'uint8')
for field in field_places:
    cv2.fillPoly(field_mask,[np.int32(field['shape']['points'])],1)
mask &= ~ndi.binary_erosion(field_mask,iterations=2)
roads=align_routes(survey['roads'],mask,scale)
road_audit=[{'id':r['id'],'pavingFraction':r['pavingFraction']} for r in roads]
principal=np.zeros(gray.shape,'uint8')
for r in roads:
    add(r['id'],'street',r['type'],{'kind':'polyline','width':r['width'],'points':r['points']},name=r['name'],labelMinScale=.5)
    cv2.polylines(principal,[np.int32(r['points'])],False,1,max(3,round(r['width'])))
principal_distance=ndi.distance_transform_edt(principal==0)
clearance=ndi.distance_transform_edt(mask)
for path in network_paths(mask):
    if np.median(path[:,0])<940*scale or np.median(path[:,1])>680*scale:
        continue
    length=float(np.sum(np.linalg.norm(np.diff(path,axis=0),axis=1)))
    direct=float(np.linalg.norm(path[-1]-path[0]))
    if direct<20 or length/max(direct,1)>1.3:
        continue
    if not 4<=np.median(clearance[path[:,1],path[:,0]])<=24:
        continue
    if np.median(principal_distance[path[:,1],path[:,0]])<3:
        continue
    points=cv2.approxPolyDP(np.float32(path),1,False)[:,0]
    points[:,0]=np.clip(points[:,0],1.5,width-1.5);points[:,1]=np.clip(points[:,1],1.5,height-1.5)
    points=points.tolist()
    if len(points)<2:
        continue
    x,y=path[len(path)//2]
    id=f'lane-{int(x):04}-{int(y):04}'
    if any(p['id']==id for p in places):
        id+='-'+hashlib.sha256(str(points).encode()).hexdigest()[:5]
    add(id,'street','lane',{'kind':'polyline','width':3,'points':points},xy=[x,y],labelMinScale=1.2)
# Square geometry follows the octagonal paving, with the monument excluded.
for square in survey['squares']:
    points=(np.array(square['points'])*scale).tolist()
    excluded=next(p for p in survey['landmarks'] if p['id']==square['excludeLandmark'])
    hole=(np.array(excluded['points'])*scale).tolist()
    add(square['id'],'street','square',{'kind':'polygon','points':points,'holes':[hole]},xy=np.array(square['anchor'])*scale,name=square['name'],description=square['description'],featured=True)

for p in field_places:
    square=p['type']=='square';category='street' if square else 'terrain'
    desc=None
    if p['name'] and p['type']=='wood':
        desc=f'{p["name"]} is an enclosed orchard. Rows of planted trees occupy the parcel shown on the map.'
    add(p['id'],category,p['type'],p['shape'],xy=[p['x'],p['y']],name=p['name'],description=desc,labelMinScale=.65)
    if not square:
        cv2.fillPoly(field_mask,[np.int32(p['shape']['points'])],1)
        for hole in p['shape'].get('holes',[]):cv2.fillPoly(field_mask,[np.int32(hole)],0)
# Every distinctive building has its own actual footprint, not a generic pin box.
landmark_mask=np.zeros(gray.shape,'uint8')
for p in survey['landmarks']:
    points=(np.array(p['points'])*scale).tolist()
    add(p['id'],p['category'],p['type'],{'kind':'polygon','points':points},xy=np.array([p['x'],p['y']])*scale,name=p['name'],description=p['description'],featured=True)
    cv2.fillPoly(landmark_mask,[np.int32(points)],1)
dock_mask=np.zeros(gray.shape,'uint8')
for shape in pier_shapes(sea,gray,scale):
    anchor=geometry(shape).representative_point();x,y=anchor.x,anchor.y
    add(f'pier-{round(x):04}-{round(y):04}','harbor','pier',shape,description='A narrow waterfront landing. The outlined deck follows the map artwork.',labelMinScale=1.2)
    cv2.fillPoly(dock_mask,[np.int32(shape['points'])],1)
breakwater=land.intersection(Polygon(np.array([[1241,887],[1228,887],[1247,779],[1258,714],[1270,681],[1280,677],[1277,701],[1268,756],[1258,815],[1251,887]])*scale))
for i,shape in enumerate(shapes(breakwater)):
    if geometry(shape).area<300:continue
    add('harbor-breakwater'+(f'-{i}' if i else ''),'harbor','harbor',shape,name='The Long Breakwater',description='A long stone harbor arm with narrow landing stages along both sides.',featured=True)
    cv2.fillPoly(dock_mask,[np.int32(shape['points'])],1)
sea_distance=ndi.distance_transform_edt(~sea)
forbidden=(sea_distance<4) | (dock_mask>0) | ndi.binary_dilation(field_mask,iterations=5) | (landmark_mask>0) | ndi.binary_dilation(mask,iterations=1)
roof_review={}
roofs=roof_candidates(gray,forbidden,survey,scale,roof_review)
trades=[('shop',t) for t in ['bakery','grocer','tailor','apothecary','fishmonger','bookseller','chandler','cheesemonger','outfitter','jeweler','spice_seller','stationer']]
crafts=[('workshop',t) for t in ['blacksmith','carpenter','cooper','potter','shoemaker','tinker','stonemason','locksmith','sailmaker','fletcher']]
landmark_geoms=[Polygon(np.array(p['points'])*scale).buffer(0) for p in survey['landmarks']]
for roof in roofs:
    if any(roof['polygon'].intersection(g).area/max(min(roof['area'],g.area),.01)>.3 for g in landmark_geoms):continue
    g=roof['polygon'].intersection(land)
    if g.is_empty:
        continue
    shape=max(shapes(g),key=lambda s:geometry(s).area,default=None)
    if shape is None:
        continue
    anchor=geometry(shape).representative_point();x,y=anchor.x,anchor.y
    id=f'roof-{round(x/scale):04}-{round(y/scale):04}'
    if any(p['id']==id for p in places):
        id+='-'+hashlib.sha256(str(shape['points']).encode()).hexdigest()[:5]
    identity=survey.get('roofIdentities',{}).get(id,{})
    id=identity.get('id',id)
    seed=int(hashlib.sha256(id.encode()).hexdigest()[:12],16);roll=seed%100
    rural=x/scale<940 or y/scale>650
    if roll<78:category,type='home','home'
    elif roll<90:category,type=trades[(seed//100)%len(trades)]
    elif roll<97:category,type=crafts[(seed//100)%len(crafts)]
    elif roll<99:category,type='tavern','tavern'
    else:category,type='guild','guild'
    if rural and category=='shop':type=['grocer','chandler','bakery'][seed%3]
    category=identity.get('category',category);type=identity.get('type',type)
    generation=identity.get('generation',{'demographics':{'population':2+seed%7}})
    add(id,category,type,shape,xy=[x,y],generation=generation,labelMinScale=1.75 if category=='home' else 1.2)

# Actual nearest segment references, sampled densely for a spatial lookup.
roads=[p for p in places if p['category']=='street' and p['shape']['kind']=='polyline']
samples=[];owners=[]
for r in roads:
    for a,b in zip(r['shape']['points'],r['shape']['points'][1:]):
        for t in np.linspace(0,1,max(2,int(np.linalg.norm(np.array(a)-b)/3)+1)):
            samples.append(np.array(a)*(1-t)+np.array(b)*t);owners.append(r['id'])
tree=cKDTree(samples)
for p in places:
    if p['category'] in ['street','terrain','water']:
        continue
    distance,index=tree.query([p['x'],p['y']]);p['context']={'street':owners[index]}
    local=[f for f in places if f['category']=='terrain' and geometry(f['shape']).distance(Point(p['x'],p['y']))<40]
    if local:p['context']['terrain']=min(local,key=lambda f:geometry(f['shape']).distance(Point(p['x'],p['y'])))['id']
# Write compact entries, with no materialized stories for ordinary roofs.
head=json.dumps({k:v for k,v in m.items() if k!='locations'},indent=2)[:-2]
output=head+',\n  "locations": [\n'+',\n'.join('    '+json.dumps(p,separators=(',',':')) for p in places)+'\n  ]\n}\n'
(ROOT/'public/data/maps/grayhaven.json').write_text(output)
audit={'imageSha256':hashlib.sha256((ROOT/survey['image']).read_bytes()).hexdigest(),'surveySha256':hashlib.sha256(survey_bytes).hexdigest(),'dimensions':[width,height],'counts':dict(Counter(p['category'] for p in places)),'total':len(places),'districtCells':cells,'missingParcels':missing_parcels,'roads':road_audit,'roofCount':len(roofs),'roofReview':roof_review}
(ROOT/'sources/grayhaven/audit.json').write_text(json.dumps(audit,indent=2)+'\n')
print(json.dumps(audit,indent=2))
