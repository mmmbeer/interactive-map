"""Raster survey helpers. Authoring only; no runtime dependencies."""
import numpy as np
from scipy import ndimage as ndi
from PIL import Image, ImageDraw


def polygon_mask(size, polygons):
    canvas = Image.new('1', size)
    draw = ImageDraw.Draw(canvas)
    for shape in polygons:
        draw.polygon([tuple(p) for p in shape['points']], fill=1)
    return np.array(canvas, dtype=bool)


def simplify(points, tolerance=.8):
    if len(points) <= 2:
        return points
    p = np.asarray(points, dtype=float)
    delta = p[-1] - p[0]
    if np.any(delta):
        t = np.clip(((p - p[0]) @ delta) / (delta @ delta), 0, 1)
        dist = np.linalg.norm(p - (p[0] + t[:, None] * delta), axis=1)
    else:
        dist = np.linalg.norm(p - p[0], axis=1)
    i = int(np.argmax(dist))
    if dist[i] <= tolerance:
        return [points[0], points[-1]]
    return simplify(points[:i+1], tolerance)[:-1] + simplify(points[i:], tolerance)


def outline(mask, left=0, top=0, tolerance=.7, all_loops=False):
    # Follow exposed pixel edges. Keep the largest exterior loop, not courtyard holes.
    edges = {}
    for y, x in zip(*np.where(mask)):
        for dy, dx, a, b in [(-1, 0, (x,y), (x+1,y)), (0,1,(x+1,y),(x+1,y+1)),
                              (1,0,(x+1,y+1),(x,y+1)), (0,-1,(x,y+1),(x,y))]:
            ny, nx = y+dy, x+dx
            if not (0 <= ny < mask.shape[0] and 0 <= nx < mask.shape[1] and mask[ny,nx]):
                edges.setdefault(a, []).append(b)
    loops = []
    while edges:
        start = next(iter(edges)); point = start; loop = [point]
        while point in edges:
            nxt = edges[point].pop()
            if not edges[point]:
                del edges[point]
            point = nxt; loop.append(point)
            if point == start:
                break
        if len(loop) > 3:
            loops.append(loop)
    if not loops:
        return []
    result = []
    for loop in sorted(loops, key=len, reverse=True):
        half = len(loop)//2
        loop = simplify(loop[:half+1], tolerance)[:-1] + simplify(loop[half:], tolerance)[:-1]
        if len(loop) >= 3:
            result.append([[int(x+left), int(y+top)] for x, y in loop])
        if not all_loops:
            break
    return result if all_loops else result[0]


def thin(mask):
    # Zhang-Suen thinning preserves connected lane centerlines.
    a = np.pad(mask, 1)
    while True:
        changed = False
        for second in [False, True]:
            p = [a[:-2,1:-1], a[:-2,2:], a[1:-1,2:], a[2:,2:],
                 a[2:,1:-1], a[2:,:-2], a[1:-1,:-2], a[:-2,:-2]]
            count = sum(q.astype('uint8') for q in p)
            transitions = sum((~p[i] & p[(i+1)%8]).astype('uint8') for i in range(8))
            if second:
                corner = ~(p[0] & p[2] & p[6]) & ~(p[0] & p[4] & p[6])
            else:
                corner = ~(p[0] & p[2] & p[4]) & ~(p[2] & p[4] & p[6])
            remove = a[1:-1,1:-1] & (count >= 2) & (count <= 6) & (transitions == 1) & corner
            if remove.any():
                a[1:-1,1:-1][remove] = False; changed = True
        if not changed:
            return a[1:-1,1:-1]


def lane_paths(mask):
    skeleton = thin(mask)
    kernel = np.ones((3,3), dtype=int); kernel[1,1] = 0
    # Remove tiny dead-end spurs caused by individual roof corners.
    for _ in range(5):
        degree = ndi.convolve(skeleton.astype(int), kernel, mode='constant')
        skeleton &= degree > 1
    pixels = set(zip(*np.where(skeleton)))
    def neighbors(p):
        y, x = p
        return [(y+dy,x+dx) for dy in [-1,0,1] for dx in [-1,0,1]
                if (dy or dx) and (y+dy,x+dx) in pixels]
    nodes = sorted(p for p in pixels if len(neighbors(p)) != 2)
    used = set(); result = []
    def edge(a,b): return tuple(sorted([a,b]))
    for start in nodes:
        for nxt in neighbors(start):
            if edge(start,nxt) in used:
                continue
            path = [start]; prev = start; point = nxt
            while True:
                used.add(edge(prev,point)); path.append(point)
                options = neighbors(point)
                if len(options) != 2:
                    break
                target = next(p for p in options if p != prev)
                if edge(point,target) in used:
                    break
                prev, point = point, target
            length = sum(np.hypot(b[0]-a[0],b[1]-a[1]) for a,b in zip(path,path[1:]))
            if length >= 8:
                result.append([[x,y] for y,x in path])
    # Closed lanes without a junction still need a trace.
    for start in sorted(pixels):
        options = [p for p in neighbors(start) if edge(start,p) not in used]
        if not options:
            continue
        path = [start]; prev = start; point = options[0]
        while True:
            used.add(edge(prev,point)); path.append(point)
            options = [p for p in neighbors(point) if edge(point,p) not in used]
            if not options:
                break
            prev, point = point, options[0]
        if len(path) >= 12:
            result.append([[x,y] for y,x in path])
    return result
