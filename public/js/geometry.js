export function boundsFor(place) {
  const shape = place.shape;
  if (shape?.kind === 'ellipse') return [place.x-shape.rx,place.y-shape.ry,shape.rx*2,shape.ry*2];
  if (shape?.kind === 'polygon') {
    const xs = shape.points.map(p => p[0]), ys = shape.points.map(p => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys);
    return [x,y,Math.max(...xs)-x,Math.max(...ys)-y];
  }
  return place.bounds || [place.x-5,place.y-5,10,10];
}
export function contains(place,x,y) {
  const [bx,by,w,h] = boundsFor(place);
  if (x<bx || x>bx+w || y<by || y>by+h) return false;
  if (place.shape?.kind === 'ellipse') return ((x-place.x)/place.shape.rx)**2+((y-place.y)/place.shape.ry)**2 <= 1;
  if (place.shape?.kind !== 'polygon') return true;
  const points = place.shape.points;
  let inside = false;
  for (let i=0,j=points.length-1;i<points.length;j=i++) {
    const [ax,ay] = points[i], [cx,cy] = points[j];
    const cross = (x-ax)*(cy-ay)-(y-ay)*(cx-ax);
    if (Math.abs(cross)<1e-8 && x>=Math.min(ax,cx) && x<=Math.max(ax,cx) && y>=Math.min(ay,cy) && y<=Math.max(ay,cy)) return true;
    if ((ay>y)!==(cy>y) && x<(cx-ax)*(y-ay)/(cy-ay)+ax) inside=!inside;
  }
  return inside;
}
export function traceShape(ctx,place) {
  ctx.beginPath();
  if (place.shape?.kind === 'ellipse') ctx.ellipse(place.x,place.y,place.shape.rx,place.shape.ry,0,0,Math.PI*2);
  else if (place.shape?.kind === 'polygon') {
    place.shape.points.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.closePath();
  } else ctx.rect(...boundsFor(place));
}
