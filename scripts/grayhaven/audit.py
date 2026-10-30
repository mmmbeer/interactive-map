"""Check saved geometry against the actual raster, topology and street references."""
import hashlib
import json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
from shapely.geometry import Point, LineString
from shapely.ops import unary_union
from raster import geometry, water_and_land

ROOT=Path(__file__).resolve().parents[2]
m=json.loads((ROOT/'public/data/maps/grayhaven.json').read_text())
audit=json.loads((ROOT/'sources/grayhaven/audit.json').read_text())
image=ROOT/'public'/m['image'];rgb=np.array(Image.open(image).convert('RGB'));gray=cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY)
assert [m['width'],m['height']]==[rgb.shape[1],rgb.shape[0]]
assert audit['imageSha256']==hashlib.sha256(image.read_bytes()).hexdigest()
assert audit['surveySha256']==hashlib.sha256((ROOT/'sources/grayhaven/survey.json').read_bytes()).hexdigest()
_,_,land=water_and_land(rgb)
districts={d['id']:unary_union([geometry(b) for b in d['boundaries']]) for d in m['districts']}
for id,g in districts.items():
    assert g.is_valid and not g.is_empty,id
    for other,h in districts.items():
        if other>id:assert g.intersection(h).area<1,(id,other)
assert unary_union(list(districts.values())).symmetric_difference(land).area<150
index={p['id']:p for p in m['locations']};assert len(index)==len(m['locations'])
fields=[];roofs=[];road_samples=[]
for p in m['locations']:
    shape=p['shape'];point=Point(p['x'],p['y'])
    if p['category']!='water':assert districts[p['district']].distance(point)<.1,p['id']
    if shape['kind']=='polygon':
        g=geometry(shape);assert g.is_valid and not g.is_empty,p['id']
        assert g.distance(point)<.2,(p['id'],'anchor outside footprint')
        if p['category']=='terrain':fields.append((p['id'],g))
        if p['id'].startswith(('roof-','building-')):
            roofs.append(p);assert index[p['context']['street']]['category']=='street',p['id']
    if shape['kind']=='polyline':
        for a,b in zip(shape['points'],shape['points'][1:]):
            length=np.linalg.norm(np.array(a)-b)
            for t in np.linspace(0,1,max(2,int(length/2))):
                x,y=np.rint(np.array(a)*(1-t)+np.array(b)*t).astype(int)
                road_samples.append(gray[min(gray.shape[0]-1,y),min(gray.shape[1]-1,x)]>190)
for i,(id,g) in enumerate(fields):
    for other,h in fields[i+1:]:assert g.intersection(h).area<.5,(id,other,'overlapping fields')
# Reject substantial duplicate footprints while allowing eaves to touch.
for i,p in enumerate(roofs):
    g=geometry(p['shape'])
    for q in roofs[i+1:]:
        if abs(p['x']-q['x'])>100 or abs(p['y']-q['y'])>100:continue
        h=geometry(q['shape']);overlap=g.intersection(h).area/max(min(g.area,h.area),.1)
        assert overlap<.65,(p['id'],q['id'],round(overlap,3),'duplicate roof')
audit['mapSha256']=hashlib.sha256((ROOT/'public/data/maps/grayhaven.json').read_bytes()).hexdigest()
audit['verification']={'districtsDisjoint':True,'districtLandCoverage':True,'parcelsDisjoint':True,'roofAnchorsInside':True,'streetReferencesValid':True,'roadBrightPixelFraction':round(float(np.mean(road_samples)),4)}
assert audit['verification']['roadBrightPixelFraction']>.94
(ROOT/'sources/grayhaven/audit.json').write_text(json.dumps(audit,indent=2)+'\n')
print(json.dumps(audit['verification'],indent=2))
