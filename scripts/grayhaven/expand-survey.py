"""Extend the Grayhaven survey from its outlined raster, preserving existing IDs.

Usage: python scripts/grayhaven/expand-survey.py
Requires Pillow, numpy and scipy. Functions and names remain fictional.
"""
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
MAP = ROOT / 'public/data/maps/grayhaven.json'
IMAGE = ROOT / 'sources/grayhaven/map-generated-v2.png'
FARMSTEADS = [(85,30),(165,35),(240,50),(390,65),(505,130),(635,150),
              (50,280),(150,245),(310,235),(475,280),(390,350),(610,350),
              (730,350),(880,350),(145,510),(340,500),(440,520),(615,600),
              (735,510),(900,510),(185,655),(450,665),(720,680),(825,690),
              (900,745),(560,845)]
RURAL_CLUSTERS = [(0,0,260,70),(275,35,455,110),(460,80,555,165),
                  (600,100,850,180),(0,265,190,315),(260,305,455,380),
                  (590,315,630,385),(680,320,750,380),(850,320,935,380),
                  (115,460,170,530),(270,390,320,470),(425,570,500,625),
                  (580,565,640,625),(700,465,755,535),(870,465,935,535),
                  (150,630,205,690),(425,630,475,700),(660,640,760,710),
                  (790,645,870,725),(850,690,930,755),(515,795,610,870)]
TYPES = [('home','home')]*15 + [('shop','bakery'),('shop','tailor'),
         ('shop','apothecary'),('shop','shop'),('workshop','blacksmith'),
         ('workshop','workshop'),('tavern','tavern'),('temple','temple'),
         ('guild','guild')]


def inside(points, x, y):
    result = False
    for (ax, ay), (bx, by) in zip(points, points[1:] + points[:1]):
        if ((ay > y) != (by > y)) and x < (bx-ax)*(y-ay)/(by-ay)+ax:
            result = not result
    return result


def district_at(m, x, y):
    return next((d['id'] for d in m['districts']
                 if any(inside(b['points'],x,y) for b in d.get('boundaries', []))), None)


def near(a, b, radius=6):
    return (a['x']-b['x'])**2 + (a['y']-b['y'])**2 < radius**2


def roof_candidates(m):
    image = np.array(Image.open(IMAGE).convert('L'))
    height, width = image.shape
    candidates = []
    # Filled roofs and enclosed light roof interiors complement one another.
    # Restrict the rural pass to surveyed farmstead clusters, away from fields.
    for threshold in [205, 175, 145, 115]:
        labels, _ = ndimage.label(image > threshold)
        sizes = np.bincount(labels.ravel())
        for label, region in enumerate(ndimage.find_objects(labels), 1):
            if region is None:
                continue
            ys, xs = region
            bw, bh = xs.stop-xs.start, ys.stop-ys.start
            area = sizes[label]
            if min(bw,bh)<3 or max(bw,bh)>13 or not 9<=area<=130 or area/(bw*bh)<.45:
                continue
            x, y = round(xs.start+bw/2,1), round(ys.start+bh/2,1)
            urban = ((x>960 and y<300) or (x>1100 and y<550) or (x>1200 and y<650))
            farm = x<950 and (any((x-fx)**2+(y-fy)**2 < 18**2 for fx,fy in FARMSTEADS) or any(x0<=x<=x1 and y0<=y<=y1 for x0,y0,x1,y1 in RURAL_CLUSTERS))
            if not (urban or farm):
                continue
            district = district_at(m,x,y)
            if not district:
                continue
            crop = image[max(0,ys.start-2):min(height,ys.stop+2),max(0,xs.start-2):min(width,xs.stop+2)]
            if np.mean(crop<110)<.20:
                continue
            candidates.append({'x':x,'y':y,'bounds':[xs.start,ys.start,bw,bh],
                               'district':district,'urban':urban})
    return candidates


def add_buildings(m):
    old = [p for p in m['locations'] if p['id'].startswith(('building-','roof-'))]
    added=[]
    for c in roof_candidates(m):
        if any(near(c,p) for p in old+added):
            continue
        x,y,w,h = c['bounds']
        # Coordinate-based IDs remain stable when other entries are added.
        id = f'roof-{x:04d}-{y:04d}-{w:02d}-{h:02d}'
        digest=hashlib.sha256(id.encode()).digest()
        category, typ = TYPES[digest[0] % len(TYPES)] if c['urban'] else ('home','home')
        place={'id':id,'category':category,'type':typ,'district':c['district'],
               'x':c['x'],'y':c['y'],'bounds':c['bounds']}
        added.append(place)
    m['locations'].extend(added)
    return len(added)


# Paths are hand-traced on visible white roads in the map image.
ROUTES = [
 ('west-farm-road','West Farm Road',[(8,764),(60,721),(110,676),(169,625),(215,575),(259,530),(294,485),(309,442),(321,337)]),
 ('south-field-road','South Field Road',[(665,874),(716,823),(765,772),(815,721),(865,673),(900,660)]),
 ('north-coast-lane','North Coast Lane',[(294,83),(350,91),(410,101),(470,105),(525,105),(575,110),(610,119),(631,145),(680,157),(745,164),(810,174),(860,187),(905,202),(950,220)]),
]
FIELDS = [
 ('west-croft','West Croft',[(33,328),(112,330),(116,395),(33,390)]),
 ('west-orchard','West Orchard',[(174,427),(250,438),(235,496),(170,497)]),
 ('garden-croft','Garden Croft',[(370,115),(442,119),(435,180),(362,199)]),
 ('garden-pasture','Garden Pasture',[(495,205),(555,174),(568,223),(544,269),(500,277)]),
 ('middle-meadow','Middle Meadow',[(320,405),(376,399),(390,453),(316,453)]),
 ('orchard-croft','Orchard Croft',[(452,520),(500,504),(545,526),(552,590),(465,600)]),
 ('crossroads-pasture','Crossroads Pasture',[(689,409),(752,409),(749,484),(690,482)]),
 ('east-croft','East Croft',[(782,497),(846,489),(867,557),(829,579),(774,552)]),
 ('south-croft','South Croft',[(183,649),(238,643),(288,666),(269,709),(199,704)]),
 ('south-orchard','South Orchard',[(679,710),(741,708),(752,772),(693,779)]),
]


def add_features(m):
    ids={p['id'] for p in m['locations']}
    for id,name,points in ROUTES:
        if id in ids:
            continue
        x,y=points[len(points)//2]; district=district_at(m,x,y)
        if district:
            m['locations'].append({'id':id,'category':'street','type':'road','district':district,
                'x':x,'y':y,'shape':{'kind':'polyline','width':7,'points':points},
                'overrides':{'name':name}})
    for id,name,points in FIELDS:
        if id in ids:
            continue
        x=round(sum(p[0] for p in points)/len(points));y=round(sum(p[1] for p in points)/len(points))
        district=district_at(m,x,y)
        if district:
            m['locations'].append({'id':id,'category':'terrain','type':'field','district':district,
                'x':x,'y':y,'shape':{'kind':'polygon','points':points},'overrides':{'name':name}})
    if 'north-bay' not in ids:
        m['locations'].append({'id':'north-bay','category':'water','type':'bay','district':'north-market',
            'x':600,'y':28,'shape':{'kind':'polygon','points':[[286,1],[1025,1],[975,34],[930,60],
                [860,94],[800,105],[680,98],[570,82],[460,62],[365,45]]},
            'overrides':{'name':'North Bay'}})



def link_nearby_roads(m):
    roads=[p for p in m['locations'] if p['category']=='street' and p.get('shape',{}).get('kind')=='polyline']
    for p in m['locations']:
        if not p['id'].startswith('roof-') or p.get('context',{}).get('street'):
            continue
        best=(float('inf'),None)
        for road in roads:
            for (ax,ay),(bx,by) in zip(road['shape']['points'],road['shape']['points'][1:]):
                dx,dy=bx-ax,by-ay
                t=max(0,min(1,((p['x']-ax)*dx+(p['y']-ay)*dy)/(dx*dx+dy*dy)))
                distance=((p['x']-ax-t*dx)**2+(p['y']-ay-t*dy)**2)**.5
                if distance < best[0]:best=(distance,road['id'])
        if best[0] <= 24:
            p.setdefault('context',{})['street']=best[1]


def main():
    m=json.loads(MAP.read_text())
    count=add_buildings(m)
    add_features(m)
    link_nearby_roads(m)
    MAP.write_text(json.dumps(m,indent=2)+'\n')
    print(f'Added {count} roof candidates; {len(m["locations"])} locations total.')


if __name__ == '__main__':
    main()
