"""Propose outlined roof footprints, rejecting round trees and hatch fragments."""
import cv2
import numpy as np
from scipy import ndimage as ndi
from shapely.geometry import Polygon
from skimage.feature import peak_local_max
from skimage.segmentation import watershed
from shapely.ops import nearest_points


def roof_candidates(gray, forbidden, survey, scale, review=None):
    review={} if review is None else review
    review.update(authoredAccepted=0,authoredUnmatched=[])
    dark_distance = ndi.distance_transform_edt(gray >= 155)
    proposals = []
    variants = [(t,k) for t in [65,90,115,140,165] for k in [3,5]] + [(t,1) for t in [115,145,175,205]]
    for threshold, kernel in variants:
        dark = (gray < threshold).astype('uint8')
        if kernel > 1:
            dark = cv2.morphologyEx(dark, cv2.MORPH_CLOSE,
                                  cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(kernel,kernel)))
        n, labels, stats, centers = cv2.connectedComponentsWithStats(1-dark)
        for label in range(1,n):
            x,y,w,h,area = stats[label]; cx,cy = centers[label]
            if min(w,h)<6 or max(w,h)>110 or not 32<=area<=3000:
                continue
            rural = cx/scale < 940 or cy/scale > 680
            allowed = any(x0*scale<=cx<=x1*scale and y0*scale<=cy<=y1*scale for x0,y0,x1,y1 in survey.get('ruralRoofAreas',[]))
            if rural and not allowed:
                continue
            if forbidden[int(cy),int(cx)]:
                continue
            component = (labels[y:y+h,x:x+w] == label).astype('uint8')
            contours,_ = cv2.findContours(component,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
            contour = max(contours,key=cv2.contourArea)
            rect = cv2.minAreaRect(contour); a,b = rect[1]
            if min(a,b)<(6 if rural else 4.5) or max(a,b)/min(a,b)>5 or a*b<(75 if rural else 40):
                continue
            fill = cv2.contourArea(contour)/(a*b)
            if fill < .69:
                continue
            box = cv2.boxPoints(rect) + [x,y]
            # Fit the dark eave just outside the enclosed light interior.
            best = None
            for margin in [0,1,2,3]:
                unit = box-box.mean(0)
                unit /= np.maximum(np.linalg.norm(unit,axis=1)[:,None],.01)
                points = box + unit*margin
                score, corner_count = border_score(points, dark_distance)
                if best is None or score > best[0]:
                    best = (score,corner_count,points)
            score,corners,points = best
            rural = cx/scale < 940 or cy/scale > 650
            if score < (.79 if rural else .70) or corners < 3:
                continue
            # Reject isolated white field spots, courtyard squares and tree cores.
            crop = gray[y:y+h,x:x+w]
            if np.mean(crop < 155)<.16:
                continue
            poly = Polygon(points)
            proposals.append({'points':points,'x':float(cx),'y':float(cy),
                              'area':poly.area,'score':score,'polygon':poly})
    # Dense hatching can leave no single enclosed light roof interior. Recover
    # those roofs from dark components after closing the hatch gaps. Opening
    # removes thin connecting block walls and hedge strokes.
    for closing,opening,threshold in [(5,3,130),(7,5,145),(5,3,180)]:
        dark=(gray<threshold).astype('uint8')
        dark=cv2.morphologyEx(dark,cv2.MORPH_CLOSE,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(closing,closing)))
        dark=cv2.morphologyEx(dark,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(opening,opening)))
        n,labels,stats,centers=cv2.connectedComponentsWithStats(dark)
        for label in range(1,n):
            x,y,w,h,area=stats[label];cx,cy=centers[label]
            rural=cx/scale<940 or cy/scale>680
            if min(w,h)<7 or max(w,h)>100 or not 65<area<3000 or forbidden[int(cy),int(cx)]:
                continue
            if rural and not any(x0*scale<=cx<=x1*scale and y0*scale<=cy<=y1*scale for x0,y0,x1,y1 in survey.get('ruralRoofAreas',[])):
                continue
            comp=(labels[y:y+h,x:x+w]==label).astype('uint8')
            contours,_=cv2.findContours(comp,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
            c=max(contours,key=cv2.contourArea);rect=cv2.minAreaRect(c);a,b=rect[1]
            if min(a,b)<6 or max(a,b)/min(a,b)>5 or cv2.contourArea(c)/max(a*b,.1)<(.84 if rural else .78):
                continue
            points=cv2.approxPolyDP(c,.7,True)[:,0]+[x,y]
            if len(points)<3:continue
            poly=Polygon(points).buffer(0)
            if poly.geom_type!='Polygon' or poly.area<65:continue
            proposals.append({'points':points,'x':float(cx),'y':float(cy),'area':poly.area,'score':.82,'polygon':poly,'outline':True})
    # Split connected rows of dark roofs at their density saddles. This recovers
    # outlined roofs whose walls join a block boundary rather than forming an
    # isolated connected component.
    dark=(gray<145).astype('uint8')
    dark=cv2.morphologyEx(dark,cv2.MORPH_CLOSE,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(7,7)))
    dark=cv2.morphologyEx(dark,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5)))
    distance=ndi.distance_transform_edt(dark)
    peaks=peak_local_max(distance,min_distance=6,threshold_abs=2.5,exclude_border=False)
    markers=np.zeros(gray.shape,'int32')
    for i,(y,x) in enumerate(peaks,1):markers[y,x]=i
    labels=watershed(-distance,markers,mask=dark>0)
    for label,region in enumerate(ndi.find_objects(labels),1):
        if region is None:continue
        ys,xs=region;crop=labels[region];values,counts=np.unique(crop[crop>0],return_counts=True)
        if not len(values):continue
        # find_objects is ordered by marker id. Identify its central segment.
        
        comp=(crop==label).astype('uint8');area=int(comp.sum())
        if not 60<area<2200 or min(comp.shape)<7 or max(comp.shape)>110:continue
        yy,xx=np.where(comp);cx=float(xx.mean()+xs.start);cy=float(yy.mean()+ys.start)
        if forbidden[int(cy),int(cx)]:continue
        rural=cx/scale<940 or cy/scale>680
        if rural and not any(x0*scale<=cx<=x1*scale and y0*scale<=cy<=y1*scale for x0,y0,x1,y1 in survey.get('ruralRoofAreas',[])):continue
        contour=max(cv2.findContours(comp,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)[0],key=cv2.contourArea)
        rect=cv2.minAreaRect(contour);a,b=rect[1]
        if min(a,b)<6 or max(a,b)/min(a,b)>5 or cv2.contourArea(contour)/max(a*b,.1)<.84:continue
        points=cv2.approxPolyDP(contour,.7,True)[:,0]+[xs.start,ys.start]
        poly=Polygon(points).buffer(0)
        if poly.geom_type!='Polygon' or poly.area<60:continue
        proposals.append({'points':points,'x':cx,'y':cy,'area':poly.area,'score':.78,'polygon':poly,'outline':True})
    rejected=[Polygon(np.array(p)*scale).buffer(0) for p in survey.get('rejectedRoofShapes',[])]
    proposals=[p for p in proposals if not any(p['polygon'].intersection(q).area/max(p['polygon'].union(q).area,.01)>.55 for q in rejected)]
    proposals.sort(key=lambda p:(-p['area'],-p['score'],p['y'],p['x']))
    roofs = []
    for p in proposals:
        if any(abs(p['x']-q['x'])<110 and abs(p['y']-q['y'])<110 and
               p['polygon'].intersection(q['polygon']).area/min(p['area'],q['area']) > .32
               for q in roofs):
            continue
        roofs.append(p)
    # A ridge can divide one hatched roof into two enclosed light components.
    # Join only adjacent, aligned fragments whose combined outer frame is dark.
    for _ in range(2):
        removed=set()
        for i,p in enumerate(roofs):
            if i in removed:
                continue
            for j in range(i+1,len(roofs)):
                if j in removed:
                    continue
                q=roofs[j]
                if p.get('outline') or q.get('outline'):
                    continue
                if abs(p['x']-q['x'])>60 or abs(p['y']-q['y'])>60:
                    continue
                if p['polygon'].distance(q['polygon'])>3.5:
                    continue
                a,b=nearest_points(p['polygon'],q['polygon'])
                midpoint=np.rint([(a.x+b.x)/2,(a.y+b.y)/2]).astype(int)
                if dark_distance[midpoint[1],midpoint[0]]>1.2:
                    continue
                points=cv2.boxPoints(cv2.minAreaRect(np.float32(np.concatenate([p['points'],q['points']]))))
                poly=Polygon(points)
                if poly.area > 1.28*(p['area']+q['area']) or poly.area>3400:
                    continue
                score,corners=border_score(points,dark_distance)
                if score<.77 or corners<3:
                    continue
                p.update(points=points,polygon=poly,area=poly.area,x=poly.centroid.x,y=poly.centroid.y,score=score)
                removed.add(j)
        roofs=[p for i,p in enumerate(roofs) if i not in removed]
    for p in survey.get('roofExclusionAreas',[]):
        exclusion=Polygon(np.array(p)*scale)
        roofs=[q for q in roofs if not exclusion.covers(q['polygon'].representative_point())]
    for p in survey.get('roofExclusions',[]):
        center=np.array(p['point'])*scale; radius=p.get('radius',5)*scale
        roofs=[q for q in roofs if np.hypot(q['x']-center[0],q['y']-center[1])>radius]
    for p in survey.get('roofAdditions',[]):
        points=fit_authored(np.array(p['points'])*scale,dark_distance)
        if points is None:
            review['authoredUnmatched'].append(np.array(p['points']).mean(0).round(1).tolist());continue
        review['authoredAccepted']+=1
        poly=Polygon(points)
        roofs=[q for q in roofs if poly.intersection(q['polygon']).area/min(poly.area,q['area'])<.3]
        roofs.append({'points':points,'polygon':poly,'x':poly.centroid.x,'y':poly.centroid.y,'area':poly.area,'score':2.0})
    unique=[]
    for p in sorted(roofs,key=lambda p:(-p['score'],-p['area'])):
        if any(abs(p['x']-q['x'])<100 and abs(p['y']-q['y'])<100 and p['polygon'].intersection(q['polygon']).area/max(min(p['area'],q['area']),.01)>.6 for q in unique):continue
        unique.append(p)
    review['authoredPublished']=sum(p['score']==2.0 for p in unique)
    return sorted(unique,key=lambda p:(p['y'],p['x']))


def border_score(points,distance):
    side_scores=[]; corners=0
    h,w=distance.shape
    for a,b in zip(points,np.roll(points,-1,axis=0)):
        samples=np.linspace(a,b,max(8,int(np.linalg.norm(b-a))))
        xy=np.rint(samples).astype(int);xy[:,0]=np.clip(xy[:,0],0,w-1);xy[:,1]=np.clip(xy[:,1],0,h-1)
        side_scores.append(np.mean(distance[xy[:,1],xy[:,0]]<=1.3))
        x,y=np.rint(a).astype(int)
        corners+=int(distance[np.clip(y,0,h-1),np.clip(x,0,w-1)]<2)
    return float(np.mean(side_scores)*.75+min(side_scores)*.25),corners


def fit_authored(points,distance):
    """Calibrate inspected eaves against dark raster edges within eight image pixels."""
    center=points.mean(0);basis=points-center;best=None
    edge=points[1]-points[0];unit=edge/max(np.linalg.norm(edge),.01)
    axes=np.array([unit,[-unit[1],unit[0]]]);local=basis@axes.T
    for angle in [-7,0,7]:
        a=np.deg2rad(angle);rotation=np.array([[np.cos(a),-np.sin(a)],[np.sin(a),np.cos(a)]])
        for sx in [.85,1,1.15]:
            for sy in [.85,1,1.15]:
                adjusted=(local*np.array([sx,sy]))@axes@rotation.T
                for dx in [-8,-4,0,4,8]:
                    for dy in [-8,-4,0,4,8]:
                        candidate=adjusted+center+[dx,dy]
                        score,corners=border_score(candidate,distance)
                        merit=score-.015*(abs(dx)+abs(dy))-.02*(abs(sx-1)+abs(sy-1))
                        if best is None or merit>best[0]:best=(merit,score,candidate)
    return best[2] if best and best[1]>=.60 else None
