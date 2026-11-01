import { joinWays } from './osm.js';
import { clipLines, clipRing, ringArea } from './geo.js';
import { ringContains } from '../geometry.js';
// Coastline direction has land on its left. In image coordinates water lies on its right.
function boundaryPosition([x,y],w,h) {
  const edges=[{d:Math.abs(y),p:x},{d:Math.abs(x-w),p:w+y},{d:Math.abs(y-h),p:w+h+(w-x)},{d:Math.abs(x),p:2*w+h+(h-y)}];
  return edges.sort((a,b)=>a.d-b.d)[0].p;
}
export function coastalWater(segments,w,h) {
  const waters=[],islands=[],corners=[[0,0],[w,0],[w,h],[0,h]],perimeter=2*(w+h),positions=[0,w,w+h,2*w+h];
  for(const chain of joinWays(segments,{directed:true})) {
    const first=chain[0],last=chain.at(-1);
    if(Math.hypot(first[0]-last[0],first[1]-last[1])<1e-5) {
      const points=clipRing(chain,w,h);if(!points.length)continue;
      if(ringArea(points)<0)islands.push(points);else waters.push({points,holes:[]});
      continue;
    }
    for(const path of clipLines(chain,w,h)) {
      const a=boundaryPosition(path.at(-1),w,h),b=boundaryPosition(path[0],w,h);
      const onEdge=p=>Math.min(Math.abs(p[0]),Math.abs(p[1]),Math.abs(p[0]-w),Math.abs(p[1]-h))<1e-4;
      if(!onEdge(path[0])||!onEdge(path.at(-1)))continue;
      const distance=(b-a+perimeter)%perimeter;
      const middle=positions.map((p,i)=>({point:corners[i],d:(p-a+perimeter)%perimeter})).filter(v=>v.d>1e-5&&v.d<distance-1e-5).sort((x,y)=>x.d-y.d).map(v=>v.point);
      const points=clipRing([...path,...middle],w,h);if(points.length)waters.push({points,holes:[]});
    }
  }
  if(!waters.length&&islands.length)waters.push({points:corners,holes:[]});
  for(const water of waters)water.holes=islands.filter(r=>r.every(([x,y])=>ringContains(water.points,x,y)));
  return waters;
}
