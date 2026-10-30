"""Trace authored routes through the connected paving mask."""
import cv2
import numpy as np
from scipy import ndimage as ndi
from skimage.graph import route_through_array


def align_routes(roads, mask, scale):
    clearance=ndi.distance_transform_edt(mask)
    outside,nearest=ndi.distance_transform_edt(~mask,return_indices=True)
    cost=np.where(mask,1+3/(clearance+.3),40+outside*8)
    h,w=mask.shape;result=[]
    for road in roads:
        points=np.array(road['points'],dtype=float)*scale
        points[:,0]=np.clip(points[:,0],6,w-7);points[:,1]=np.clip(points[:,1],6,h-7)
        snapped=[]
        for x,y in np.rint(points).astype(int):
            ny,nx=nearest[:,y,x]
            snapped.append([int(nx),int(ny)] if outside[y,x]<30 else [int(x),int(y)])
        path=[]
        for a,b in zip(snapped,snapped[1:]):
            if a==b:
                continue
            left=max(1,min(a[0],b[0])-32);right=min(w-2,max(a[0],b[0])+32)
            top=max(1,min(a[1],b[1])-32);bottom=min(h-2,max(a[1],b[1])+32)
            segment,_=route_through_array(cost[top:bottom+1,left:right+1],(a[1]-top,a[0]-left),(b[1]-top,b[0]-left),fully_connected=True)
            segment=[[x+left,y+top] for y,x in segment]
            path.extend(segment if not path else segment[1:])
        if len(path)<2:
            continue
        path=np.array(path);points=cv2.approxPolyDP(np.float32(path),1.0,False)[:,0].round(1).tolist()
        widths=clearance[path[:,1],path[:,0]]
        width=round(min(road['width']*scale,max(3,float(np.median(widths))*1.55)),1)
        points=[[max(width/2,min(w-width/2,x)),max(width/2,min(h-width/2,y))] for x,y in points]
        result.append({**road,'points':points,'width':width,'pavingFraction':round(float(np.mean(mask[path[:,1],path[:,0]])),4)})
    return result
