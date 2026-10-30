"""Match verified new footprints to old links without reusing old geometry.
Usage: python scripts/grayhaven/preserve-identities.py /path/to/previous-map.json
Run once after the survey is reviewed, then rebuild from survey.json as usual.
"""
import json
import sys
from pathlib import Path
import numpy as np
from shapely.geometry import Point, Polygon, box

ROOT=Path(__file__).resolve().parents[2]
path=ROOT/'sources/grayhaven/survey.json';survey=json.loads(path.read_text())
previous=json.loads(Path(sys.argv[1]).read_text())
current=json.loads((ROOT/'public/data/maps/grayhaven.json').read_text())
scale=current['width']/previous['width']
old=[p for p in previous['locations'] if p['id'].startswith(('roof-','building-'))]
identities={};used=set()
for p in current['locations']:
    if not p['id'].startswith(('roof-','building-')):continue
    poly=Polygon(p['shape']['points']).buffer(0);candidates=[]
    for q in old:
        if q['id'] in used or np.hypot(p['x']-q['x']*scale,p['y']-q['y']*scale)>7:continue
        if not poly.buffer(1).covers(Point(q['x']*scale,q['y']*scale)):continue
        if q.get('shape',{}).get('kind')=='polygon':g=Polygon(np.array(q['shape']['points'])*scale).buffer(0)
        elif 'bounds' in q:
            x,y,w,h=np.array(q['bounds'])*scale;g=box(x,y,x+w,y+h)
        else:continue
        overlap=poly.intersection(g).area/max(poly.union(g).area,.1)
        if overlap>.15:candidates.append((overlap,q))
    if not candidates:continue
    q=max(candidates,key=lambda v:v[0])[1];used.add(q['id'])
    raw_id=f'roof-{round(p["x"]/current["width"]*survey["inspectionGrid"][0]):04}-{round(p["y"]/current["height"]*survey["inspectionGrid"][1]):04}'
    identities[raw_id]={k:q[k] for k in ['id','category','type']}
    identities[raw_id]['generation']=q.get('generation',{})
survey['roofIdentities']=identities
path.write_text(json.dumps(survey,indent=2)+'\n')
print(f'Preserved {len(identities)} verified building links.')
