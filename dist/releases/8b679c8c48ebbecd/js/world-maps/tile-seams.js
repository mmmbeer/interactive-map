// Union polygons from disjoint tile interiors by cancelling shared boundary edges.
// This retains courtyards and avoids duplicate buildings at tile seams.
import { ringArea } from './geo.js';
const key=p=>`${p[0]},${p[1]}`;
export function unionTileRings(rings,size=4096) {
  const edges=new Map(),seams=new Map();
  const add=(a,b)=>{
    if(key(a)===key(b))return;
    const k=`${key(a)}>${key(b)}`,reverse=`${key(b)}>${key(a)}`;
    if(edges.has(reverse))edges.delete(reverse);else edges.set(k,{a,b});
  };
  for(const ring of rings)for(let i=0;i<ring.length;i++) {
    const a=ring[i],b=ring[(i+1)%ring.length];if(key(a)===key(b))continue;
    const axis=a[0]===b[0]&&a[0]%size===0?0:a[1]===b[1]&&a[1]%size===0?1:-1;
    if(axis<0){add(a,b);continue;}
    const id=`${axis}:${a[axis]}`;if(!seams.has(id))seams.set(id,{axis,fixed:a[axis],events:new Map()});
    const events=seams.get(id).events,from=a[1-axis],to=b[1-axis],lo=Math.min(from,to),hi=Math.max(from,to),d=to>from?1:-1;
    events.set(lo,(events.get(lo)||0)+d);events.set(hi,(events.get(hi)||0)-d);
  }
  for(const {axis,fixed,events} of seams.values()) {
    const stops=[...events.keys()].sort((a,b)=>a-b);let count=0;
    for(let i=0;i<stops.length-1;i++) {
      count+=events.get(stops[i]);if(!count)continue;
      const lo=axis===0?[fixed,stops[i]]:[stops[i],fixed],hi=axis===0?[fixed,stops[i+1]]:[stops[i+1],fixed];
      count>0?add(lo,hi):add(hi,lo);
    }
  }
  const outgoing=new Map();
  for(const edge of edges.values()){const k=key(edge.a);if(!outgoing.has(k))outgoing.set(k,new Set());outgoing.get(k).add(edge);}
  const remaining=new Set(edges.values()),result=[];
  while(remaining.size) {
    let edge=remaining.values().next().value;const start=edge.a,ring=[start];
    while(true) {
      if(!remaining.delete(edge))throw new Error('Prepared map boundaries could not be joined. Try Live map data.');
      outgoing.get(key(edge.a)).delete(edge);ring.push(edge.b);
      if(key(edge.b)===key(start))break;
      const next=[...(outgoing.get(key(edge.b))||[])];
      if(!next.length)throw new Error('Prepared map boundaries are incomplete. Try Live map data.');
      const dx=edge.b[0]-edge.a[0],dy=edge.b[1]-edge.a[1];
      const turn=e=>Math.atan2(dx*(e.b[1]-e.a[1])-dy*(e.b[0]-e.a[0]),dx*(e.b[0]-e.a[0])+dy*(e.b[1]-e.a[1]));
      next.sort((a,b)=>turn(b)-turn(a));edge=next[0];
    }
    ring.pop();
    const clean=ring.filter((b,i)=>{const a=ring[(i+ring.length-1)%ring.length],c=ring[(i+1)%ring.length];return (b[0]-a[0])*(c[1]-b[1])!==(b[1]-a[1])*(c[0]-b[0]);});
    if(clean.length>=3&&Math.abs(ringArea(clean))>0)result.push(clean);
  }
  return result;
}
