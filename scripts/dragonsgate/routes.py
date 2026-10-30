"""Align surveyed route waypoints to visible paving and pier decks."""
import heapq
import numpy as np
from scipy import ndimage as ndi
from raster import simplify


def align_routes(roads,rgb):
    grey=np.min(rgb,axis=2).astype(float)
    white=(grey>165)&((np.max(rgb,axis=2)-grey)<35)
    _,nearest=ndi.distance_transform_edt(~white,return_indices=True)
    clearance=ndi.distance_transform_edt(white)
    cost=np.where(white,1+1/(clearance+.25),60.)
    sea=(rgb[:,:,2].astype(int)-rgb[:,:,0]>5)&(rgb[:,:,0]>65)
    cost[sea]=150
    height,width=white.shape
    def snap(p):
        x,y=map(int,p);ny,nx=nearest[:,y,x]
        return (int(nx),int(ny)) if np.hypot(nx-x,ny-y)<=14 else (x,y)
    def route(a,b):
        left=max(1,min(a[0],b[0])-22);right=min(width-2,max(a[0],b[0])+22)
        top=max(1,min(a[1],b[1])-22);bottom=min(height-2,max(a[1],b[1])+22)
        distance={a:0.};parent={};queue=[(0.,a)]
        while queue:
            _,p=heapq.heappop(queue)
            if p==b:
                path=[p]
                while p in parent:
                    p=parent[p];path.append(p)
                return list(reversed(path))
            x,y=p
            for dx,dy in [(0,-1),(1,0),(0,1),(-1,0),(-1,-1),(1,-1),(1,1),(-1,1)]:
                nx,ny=x+dx,y+dy
                if not (left<=nx<=right and top<=ny<=bottom):
                    continue
                q=(nx,ny);step=1.4142 if dx and dy else 1
                candidate=distance[p]+step*(cost[y,x]+cost[ny,nx])/2
                if candidate>=distance.get(q,float('inf')):
                    continue
                distance[q]=candidate;parent[q]=p
                heapq.heappush(queue,(candidate+np.hypot(nx-b[0],ny-b[1]),q))
        return [a,b]
    for road in roads:
        if road['type']=='bridge':
            continue
        points=[snap(p) for p in road['points']];path=[]
        for a,b in zip(points,points[1:]):
            segment=route(a,b)
            path.extend(segment if not path else segment[1:])
        if not path:
            continue
        road['points']=[list(p) for p in simplify(path,.6)]
        # Geometry describes the deck, not a broad buffer over adjacent roofs.
        road['width']=min(road['width'],max(2,round(float(np.median([clearance[y,x] for x,y in path]))*1.4,1)))
