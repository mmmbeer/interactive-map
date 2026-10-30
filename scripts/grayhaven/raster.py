"""Image-space geometry for the Grayhaven authoring workflow (not runtime)."""
import cv2
import numpy as np
from scipy import ndimage as ndi
from shapely.geometry import Polygon, LineString, Point, box
from shapely.ops import split, unary_union, nearest_points
from skimage.morphology import skeletonize
from skimage.graph import route_through_array


def polygon(mask, tolerance=1.0):
    contours, hierarchy = cv2.findContours(mask.astype('uint8'), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    if hierarchy is None:
        return []
    result = []
    for i, contour in enumerate(contours):
        if hierarchy[0, i, 3] != -1 or cv2.contourArea(contour) < 8:
            continue
        points = cv2.approxPolyDP(contour, tolerance, True)[:, 0].tolist()
        if len(points) < 3:
            continue
        holes = []
        child = hierarchy[0, i, 2]
        while child >= 0:
            ring = cv2.approxPolyDP(contours[child], tolerance, True)[:, 0].tolist()
            if len(ring) >= 3:
                holes.append(ring)
            child = hierarchy[0, child, 0]
        result.append({'kind': 'polygon', 'points': points, **({'holes': holes} if holes else {})})
    return result


def geometry(shape):
    return Polygon(shape['points'], shape.get('holes', [])).buffer(0)


def shapes(geom, tolerance=0):
    if tolerance:
        geom = geom.simplify(tolerance, preserve_topology=True)
    polygons = list(geom.geoms) if geom.geom_type == 'MultiPolygon' else [geom]
    result = []
    for p in polygons:
        if p.geom_type != 'Polygon' or p.area < 6:
            continue
        ring = lambda coords: [[round(x, 2), round(y, 2)] for x, y in list(coords)[:-1]]
        result.append({'kind': 'polygon', 'points': ring(p.exterior.coords),
                       **({'holes': [ring(r.coords) for r in p.interiors]} if p.interiors else {})})
    return result


def water_and_land(rgb):
    r, g, b = [rgb[:, :, i].astype(int) for i in range(3)]
    sea = (b-r > 14) & (g-r > 9) & (r < 215)
    sea = ndi.binary_fill_holes(sea)
    labels, _ = ndi.label(sea)
    counts = np.bincount(labels.ravel())
    sea &= counts[labels] > 300
    # Keep waterfront decks and the long breakwater as land exclusions.
    waters = polygon(sea, .85)
    for shape in waters:
        for ring in [shape['points'], *shape.get('holes', [])]:
            for point in ring:
                if point[0] == rgb.shape[1]-1: point[0] = rgb.shape[1]
                if point[1] == rgb.shape[0]-1: point[1] = rgb.shape[0]
    land = box(0, 0, rgb.shape[1], rgb.shape[0]).difference(unary_union([geometry(s) for s in waters]))
    return sea, waters, land


def districts(survey, land, scale):
    parts = list(land.geoms) if land.geom_type == 'MultiPolygon' else [land]
    for seam in survey['districtSeams']:
        points = np.array(seam,dtype=float)*scale
        boundary = unary_union([p.boundary for p in parts])
        for end in [0,-1]:
            point = Point(points[end])
            if point.distance(boundary) < 45:
                snapped = np.array(nearest_points(point,boundary)[1].coords[0])
                other = points[1 if end == 0 else -2]
                direction = snapped-other
                points[end] = snapped + direction/max(np.linalg.norm(direction),.01)*2
        cutter = LineString(points)
        # Snap seam endpoints/intersections through polygonization by splitting
        # all current land cells. Each resulting cell must have an authored seed.
        result = []
        for part in parts:
            result.extend(p for p in split(part, cutter).geoms if p.geom_type == 'Polygon')
        parts = result
    seeds = [(d, Point(np.array(d['seed'])*scale)) for d in survey['districts']]
    assigned = {d['id']: [] for d in survey['districts']}
    cells = []
    for part in parts:
        if part.area < 20:
            continue
        owners = [(d, p) for d, p in seeds if part.covers(p)]
        if len(owners) > 1:
            raise ValueError(f'District seam is open: {[d["id"] for d, _ in owners]}')
        # Offshore deck slivers inherit the nearest authored district.
        owner = owners[0][0] if owners else min(seeds, key=lambda v: part.distance(v[1]))[0]
        assigned[owner['id']].append(part)
        cells.append((owner['id'], part.area, bool(owners)))
    result = []
    for d in survey['districts']:
        geom = unary_union(assigned[d['id']])
        if geom.is_empty:
            raise ValueError(f'No land for {d["id"]}')
        result.append({'id': d['id'], 'name': d['name'], 'region': d['region'],
                       'label': dict(zip(['x','y'], (np.array(d['seed'])*scale).tolist())),
                       'boundaries': shapes(geom)})
    return result, cells


def street_mask(gray, roads, scale):
    white = (gray > 222).astype('uint8')
    white = cv2.morphologyEx(white, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5,5)))
    n, labels, stats, _ = cv2.connectedComponentsWithStats(white)
    selected = {1+int(np.argmax(stats[1:,4]))}
    # Narrow lanes interrupted by trees are separate from the main component.
    # Admit a component only when it intersects an explicitly surveyed route.
    reference = np.zeros(gray.shape, dtype='uint8')
    for road in roads:
        cv2.polylines(reference, [np.int32(np.array(road['points'])*scale)], False, 1, 5)
    for label in np.unique(labels[reference > 0]):
        if label and stats[label,4] >= 100:
            selected.add(int(label))
    mask = np.isin(labels, list(selected))
    corridor = np.zeros(gray.shape,dtype='uint8')
    for road in roads:
        cv2.polylines(corridor,[np.int32(np.array(road['points'])*scale)],False,1,16)
    mask |= (gray>205)&(corridor>0)
    mask = cv2.morphologyEx(mask.astype('uint8'),cv2.MORPH_CLOSE,np.ones((3,3),'uint8')).astype(bool)
    return mask


def network_paths(mask):
    skeleton = skeletonize(mask)
    # Remove short dangling branches left by paving imperfections.
    kernel = np.ones((3,3), int); kernel[1,1] = 0
    for _ in range(10):
        degree = ndi.convolve(skeleton.astype(int), kernel, mode='constant')
        skeleton &= degree > 1
    pixels = set(zip(*np.where(skeleton)))
    def neighbors(p):
        y,x = p
        return [(y+dy,x+dx) for dy in [-1,0,1] for dx in [-1,0,1]
                if (dy or dx) and (y+dy,x+dx) in pixels]
    used = set(); result = []
    def edge(a,b): return tuple(sorted((a,b)))
    def follow(start, nxt):
        path = [start]; previous = start; current = nxt
        while True:
            used.add(edge(previous,current)); path.append(current)
            options = [p for p in neighbors(current) if p != previous]
            if len(options) != 1 or edge(current,options[0]) in used:
                break
            previous,current = current,options[0]
        return path
    for start in sorted(pixels):
        if len(neighbors(start)) == 2:
            continue
        for nxt in neighbors(start):
            if edge(start,nxt) not in used:
                result.append(follow(start,nxt))
    for start in sorted(pixels):
        for nxt in neighbors(start):
            if edge(start,nxt) not in used:
                result.append(follow(start,nxt))
    return [np.array([[x,y] for y,x in p]) for p in result
            if sum(np.linalg.norm(np.array(b)-a) for a,b in zip(p,p[1:])) >= 18]


def parcels(gray, survey, roads_mask, scale):
    result=[];claimed=Polygon()
    dark=gray<150
    distance,nearest=ndi.distance_transform_edt(~dark,return_indices=True)
    cost=1+gray.astype(float)/35
    h,w=gray.shape
    for p in survey['parcels']:
        raw=np.array(p['points'],dtype=float)*scale;raw[:,0]=np.clip(raw[:,0],0,w-1);raw[:,1]=np.clip(raw[:,1],0,h-1)
        points=[]
        for x,y in np.rint(raw).astype(int):
            ny,nx=nearest[:,y,x]
            points.append([int(nx),int(ny)] if distance[y,x]<9 else [int(x),int(y)])
        path=[]
        for a,b in zip(points,points[1:]+points[:1]):
            left=max(0,min(a[0],b[0])-12);right=min(w-1,max(a[0],b[0])+12)
            top=max(0,min(a[1],b[1])-12);bottom=min(h-1,max(a[1],b[1])+12)
            yy,xx=np.mgrid[top:bottom+1,left:right+1];delta=np.array(b)-a
            t=np.clip(((xx-a[0])*delta[0]+(yy-a[1])*delta[1])/max(float(delta@delta),1),0,1)
            deviation=np.hypot(xx-a[0]-t*delta[0],yy-a[1]-t*delta[1])
            segment,_=route_through_array(cost[top:bottom+1,left:right+1]+deviation*.12,(a[1]-top,a[0]-left),(b[1]-top,b[0]-left),fully_connected=True)
            path.extend([[x+left,y+top] for y,x in segment][bool(path):])
        points=cv2.approxPolyDP(np.float32(path),1.2,True)[:,0].tolist()
        geom=Polygon(points).buffer(0).difference(claimed)
        if geom.is_empty:raise ValueError(f'Parcel is entirely duplicated: {p["id"]}')
        shape=max(shapes(geom),key=lambda s:geometry(s).area)
        geom=geometry(shape);claimed=unary_union([claimed,geom]);anchor=geom.representative_point()
        result.append({**p,'shape':shape,'x':round(anchor.x,1),'y':round(anchor.y,1)})
    return result, []


def pier_shapes(sea, gray, scale):
    """Trace visible landing stages without classifying quay walls as houses."""
    land=(~sea).astype('uint8')
    opened=cv2.morphologyEx(land,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(41,41)))
    away=ndi.distance_transform_edt(opened==0)
    narrow=(land>0)&(away>2)
    n,labels,stats,centers=cv2.connectedComponentsWithStats(narrow.astype('uint8'))
    result=[]
    for label in range(1,n):
        x,y,w,h,area=stats[label]
        if not 14<area<2000 or min(w,h)<3 or max(w,h)<9:continue
        comp=(labels[y:y+h,x:x+w]==label).astype('uint8')
        if np.max(away[y:y+h,x:x+w][comp>0])<6:continue
        contour=max(cv2.findContours(comp,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)[0],key=cv2.contourArea)
        a,b=cv2.minAreaRect(contour)[1]
        if min(a,b)<2 or max(a,b)/min(a,b)<1.1:continue
        if np.mean(gray[y:y+h,x:x+w][comp>0]<150)>.65:continue
        traced=polygon(comp,.6)
        if not traced:continue
        shape=max(traced,key=lambda s:geometry(s).area)
        for ring in [shape['points'],*shape.get('holes',[])]:
            for point in ring:point[0]+=int(x);point[1]+=int(y)
        result.append(shape)
    return result
