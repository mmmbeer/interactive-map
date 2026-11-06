import { boundsFor, contains, distanceToPath } from '../geometry.js';
export const overlaps=(a,b)=>a[0]<=b[0]+b[2]&&a[0]+a[2]>=b[0]&&a[1]<=b[1]+b[3]&&a[1]+a[3]>=b[1];
const corners=([x,y,w,h])=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
// Segment/rectangle clipping also detects thin roads crossing between corners.
export function crosses(a,b,box) {
  let lo=0,hi=1;
  for(let axis=0;axis<2;axis++) {
    const delta=b[axis]-a[axis],min=box[axis],max=min+box[axis+2];
    if(!delta){if(a[axis]<min||a[axis]>max)return false;continue;}
    const t=(min-a[axis])/delta,u=(max-a[axis])/delta;
    lo=Math.max(lo,Math.min(t,u));hi=Math.min(hi,Math.max(t,u));if(lo>hi)return false;
  }
  return true;
}
function ringCrosses(ring,box) {return ring.some((p,i)=>crosses(p,ring[(i+1)%ring.length],box));}
export function fits(place,box) {
  const vertices=corners(box);
  if(!vertices.every(([x,y])=>contains(place,x,y)))return false;
  if(place.shape?.kind==='polyline') {
    // One segment's capsule must contain the whole box. Corners on opposite
    // sides of a river bend must not let a boat bridge the dry peninsula.
    const {points,width}=place.shape;
    return points.some((p,i)=>i&&vertices.every(([x,y])=>distanceToPath([points[i-1],p],x,y)<=width/2));
  }
  return place.shape?.kind!=='polygon'||![place.shape.points,...(place.shape.holes||[])].some(ring=>ringCrosses(ring,box));
}
function intersects(place,box) {
  const shape=place.shape;if(!overlaps(boundsFor(place),box))return false;
  if(shape?.kind==='polyline') {
    const r=shape.width/2,b=[box[0]-r,box[1]-r,box[2]+r*2,box[3]+r*2];
    return shape.points.some((p,i)=>i&&crosses(shape.points[i-1],p,b));
  }
  if(shape?.kind!=='polygon')return true;
  return corners(box).some(([x,y])=>contains(place,x,y))||[shape.points,...(shape.holes||[])].some(r=>ringCrosses(r,box));
}
export function spatialIndex(size) {
  const bins=new Map();
  const keys=box=>{
    const keys=[];
    for(let y=Math.floor(box[1]/size);y<=Math.floor((box[1]+box[3])/size);y++)for(let x=Math.floor(box[0]/size);x<=Math.floor((box[0]+box[2])/size);x++)keys.push(`${x},${y}`);
    return keys;
  };
  return {
    add(item,box){for(const key of keys(box)){if(!bins.has(key))bins.set(key,[]);bins.get(key).push(item);}},
    query(box){return new Set(keys(box).flatMap(key=>bins.get(key)||[]));}
  };
}
export function decorationSpace(map,unit) {
  const blockers=spatialIndex(128*unit),marks=spatialIndex(32*unit),waters=[];
  for(const p of map.locations) {
    if(p.category==='water')waters.push(p);
    if(p.category==='water'||p.category==='street'||p.worldStyle?.kind==='building')blockers.add(p,boundsFor(p));
  }
  const free=(box,onWater=false)=>{
    if(box[0]<0||box[1]<0||box[0]+box[2]>map.width||box[1]+box[3]>map.height)return false;
    const nearby=blockers.query(box);
    for(const p of nearby)if(!(onWater&&p.category==='water')&&intersects(p,box))return false;
    for(const b of marks.query(box))if(overlaps(b,box))return false;
    return !onWater||[...nearby].some(p=>p.category==='water'&&fits(p,box));
  };
  waters.sort((a,b)=>a.id.localeCompare(b.id));
  return {free,claim(box){marks.add(box,box);},waters,waterAt:box=>[...blockers.query(box)].filter(p=>p.category==='water')};
}
