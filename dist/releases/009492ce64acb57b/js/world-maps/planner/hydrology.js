import { MinHeap } from '../settlement-grid.js';
import { blockers, routeClear } from '../procedural-space.js';
import { randomFor } from './random.js';
import { distance } from './geometry.js';
import { addFeature } from './features.js';
function soften(points,heights) {
  const next=[points[0]],z=[heights[0]];
  for(let i=1;i<points.length;i++)for(const t of [.25,.75]) {
    next.push(points[i-1].map((v,k)=>v*(1-t)+points[i][k]*t));z.push(heights[i-1]*(1-t)+heights[i]*t);
  }
  next.push(points.at(-1));z.push(heights.at(-1));return {points:next,heights:z};
}
// Priority-flood constructs an acyclic drainage tree. Heights are conditioned
// upwards from outlets, so every parent is strictly lower than its tributaries.
export function drainage(state) {
  const {points,neighbors,elevations,extent,spacing}=state,n=points.length;
  const downstream=new Int32Array(n);downstream.fill(-1);
  const filled=Float64Array.from(elevations),seen=new Uint8Array(n),heap=new MinHeap(),order=[];
  for(let i=0;i<n;i++) {
    const [x,y]=points[i],boundary=Math.min(x,y,state.map.width-x,state.map.height-y)<spacing*1.8;
    if(state.water[i]||boundary){seen[i]=1;heap.push([filled[i],i]);}
  }
  while(heap.items.length) {
    const [,i]=heap.pop();order.push(i);
    for(const j of neighbors[i])if(!seen[j]) {
      seen[j]=1;downstream[j]=i;filled[j]=Math.max(filled[j],filled[i]+distance(points[i],points[j])/extent*.002);heap.push([filled[j],j]);
    }
  }
  const random=randomFor(state.map,'rainfall'),flow=Float64Array.from(points,()=>.5+random());
  for(const i of [...order].reverse())if(downstream[i]>=0)flow[downstream[i]]+=flow[i];
  state.elevations=[...filled];state.drainage={downstream,flow,order};return state.drainage;
}
export function generateDrainage(state,needs) {
  const {downstream,flow}=state.drainage||drainage(state);if(!needs('water'))return;
  const {points,unit}=state,space=blockers(state.map,{roads:true});
  const candidates=points.map((_,i)=>i).filter(i=>state.dry[i]&&flow[i]>7&&downstream[i]>=0)
    .sort((a,b)=>flow[b]-flow[a]||a-b);
  const claimed=new Set();let rivers=0;
  // Trace high-flow trunks first; shorter tributaries stop at the shared trunk.
  for(const start of candidates) {
    if(rivers>=4||claimed.has(start))continue;
    const indices=[];let at=start;
    while(at>=0&&!state.water[at]) {indices.push(at);if(claimed.has(at))break;at=downstream[at];}
    if(at>=0&&state.water[at])indices.push(at);
    if(indices.length<4)continue;
    // Include upstream source reaches until a meaningful channel length exists.
    let up=start;
    while(indices.length<14) {
      const branches=state.neighbors[up].filter(j=>downstream[j]===up&&state.dry[j]&&!claimed.has(j)).sort((a,b)=>flow[b]-flow[a]||a-b);
      if(!branches.length)break;up=branches[0];indices.unshift(up);
    }
    let path=indices.map(i=>points[i]),heights=indices.map(i=>state.elevations[i]);
    const width=unit*Math.min(18,3+Math.sqrt(flow[indices.at(-1)])*.8);
    const dryPath=path.filter((_,i)=>!state.water[indices[i]]);
    if(dryPath.length<4||!routeClear(dryPath,width,space))continue;
    const end=indices.at(-1),joins=claimed.has(end);
    for(let pass=0;pass<2;pass++) {
      const smooth=soften(path,heights);
      if(!routeClear(smooth.points.slice(0,state.water[end]?-3:undefined),width,space))break;
      path=smooth.points;heights=smooth.heights;
    }
    // The last wet vertex joins an existing water body; the dry reach was checked.
    const p=addFeature(state,'water',rivers?'stream':'river',{kind:'polyline',points:path,width},{flow:'conditioned-drainage',network:'drainage-v2'});
    state.channels.push({id:p.id,points:path,elevations:heights,discharge:flow[end],outlet:joins?'confluence':state.water[end]?'water':'boundary'});
    indices.forEach(i=>claimed.add(i));rivers++;
  }
  if(!rivers)state.warnings.push('No connected river reach fits around the retained features. Dry land is still available for settlement.');
}
