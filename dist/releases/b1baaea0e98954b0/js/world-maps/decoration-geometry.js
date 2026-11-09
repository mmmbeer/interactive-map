import { shapeProbe } from './shape-probe.js';
export const overlaps=(a,b)=>a[0]<=b[0]+b[2]&&a[0]+a[2]>=b[0]&&a[1]<=b[1]+b[3]&&a[1]+a[3]>=b[1];
export { crosses } from './shape-probe.js';
export function fits(place,box) {return shapeProbe(place).fits(box);}
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
  const blockers=spatialIndex(128*unit),marks=spatialIndex(32*unit),waters=[],probes=new WeakMap();
  for(const p of map.locations) {
    if(p.category==='water')waters.push(p);
    if(p.category==='water'||p.category==='street'||p.worldStyle?.kind==='building'){const probe=shapeProbe(p);probes.set(p,probe);blockers.add(p,probe.box);}
  }
  const free=(box,onWater=false,collisionBox=box)=>{
    if(box[0]<0||box[1]<0||box[0]+box[2]>map.width||box[1]+box[3]>map.height)return false;
    const nearby=blockers.query(box);
    for(const p of nearby)if(!(onWater&&p.category==='water')&&probes.get(p).intersects(box))return false;
    for(const b of marks.query(collisionBox))if(overlaps(b,collisionBox))return false;
    return !onWater||[...nearby].some(p=>p.category==='water'&&probes.get(p).fits(box));
  };
  waters.sort((a,b)=>a.id.localeCompare(b.id));
  return {free,claim(box){marks.add(box,box);},waters,waterAt:box=>[...blockers.query(box)].filter(p=>p.category==='water')};
}
