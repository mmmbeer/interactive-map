import { Delaunay } from '../../vendor/planner.js';
import { MinHeap } from '../settlement-grid.js';
import { distance, project, length } from './geometry.js';
import { quarterAt } from './anchors.js';
import { randomFor } from './random.js';
import { linkKey } from './bridges.js';
const counts={hamlet:16,village:27,farming_village:30,town:64,city:116,metropolis:170,port:100,mining_outpost:20,forest_hold:36,fortress:43,monastery:25,academy:48,caravan_stop:20,undercity:65};
export const roadWidths={majorRoads:19,roads:12,cityStreets:8,paths:4};
function route(state,start,goal) {
  const {points,elevations,links}=state,n=points.length,previous=new Int32Array(n),cost=new Float64Array(n),heap=new MinHeap();
  cost.fill(Infinity);previous.fill(-1);cost[start]=0;heap.push([0,start]);
  while(heap.items.length) {
    const [d,i]=heap.pop();if(d!==cost[i])continue;if(i===goal)break;
    for(const j of links[i]) {
      const span=distance(points[i],points[j]),slope=Math.abs(elevations[j]-elevations[i]);
      const next=d+span*(1+slope*8+(state.used.has(i<j?`${i}:${j}`:`${j}:${i}`)?-.18:0));
      if(next>=cost[j]-1e-8)continue;cost[j]=next;previous[j]=i;heap.push([next,j]);
    }
  }
  if(!Number.isFinite(cost[goal]))return [];
  const path=[];for(let i=goal;i!==-1;i=previous[i])path.push(i);return path.reverse();
}
export function generateRoadCandidates(state,needs) {
  const {points,map,unit}=state,random=randomFor(map,'street-sites'),allowed=Object.keys(roadWidths).filter(needs);
  state.routes=[];state.used=new Set();if(!allowed.length)return;
  const corePoint=state.anchors.find(a=>a.role==='market')?.point||[map.width/2,map.height/2];
  const rural=['hamlet','village','farming_village'].includes(state.profile.type);
  const eligible=points.map((point,index)=>({point,index,q:quarterAt(state,point)})).filter(p=>state.links[p.index].length&&distance(p.point,corePoint)<state.extent*(rural?.48:.4));
  const ranked=eligible.map(p=>({...p,score:-Math.log(Math.max(1e-9,random()))/(p.q.density*Math.exp(-p.q.distance/(state.extent*.14)))})).sort((a,b)=>a.score-b.score||a.index-b.index);
  const chosen=new Map();
  for(const a of state.anchors)if(state.links[a.index].length)chosen.set(a.index,{point:a.point,index:a.index,role:a.role});
  for(const p of ranked.slice(0,counts[state.profile.type]||64))if(!chosen.has(p.index))chosen.set(p.index,p);
  const sites=[...chosen.values()],mesh=Delaunay.from(sites.map(p=>p.point)),pairs=[];
  for(let i=0;i<sites.length;i++)for(const j of mesh.neighbors(i))if(j>i)pairs.push({i,j,d:distance(sites[i].point,sites[j].point)});
  pairs.sort((a,b)=>a.d-b.d||a.i-b.i||a.j-b.j);
  const parent=sites.map((_,i)=>i),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  const tree=[],loops=[];
  for(const edge of pairs) {
    const a=find(edge.i),b=find(edge.j);
    if(a!==b){parent[a]=b;tree.push(edge);}else if(random()<.44)loops.push(edge);
  }
  // Long-distance intentions are laid first. Local loops then enclose useful blocks.
  const core=state.anchors.find(a=>a.role==='market');
  const primary=core?state.anchors.filter(a=>a!==core).map(a=>({start:core.index,goal:a.index,role:a.role})):[];
  let accepted=0;
  const add=(start,goal,preferred)=>{
    let group=needs(preferred)?preferred:allowed.find(k=>k!=='paths')||allowed[0];
    const indices=route(state,start,goal);if(indices.length<2)return false;
    const fresh=indices.slice(1).some((j,k)=>!state.used.has(indices[k]<j?`${indices[k]}:${j}`:`${j}:${indices[k]}`));
    if(!fresh)return false;
    const width=roadWidths[group]*unit,chunks=[];let chunk=[points[indices[0]]];
    for(let k=1;k<indices.length;k++) {
      if(state.crossings.has(linkKey(indices[k-1],indices[k]))) {if(chunk.length>1)chunks.push(chunk);chunk=[points[indices[k]]];}
      else chunk.push(points[indices[k]]);
    }
    if(chunk.length>1)chunks.push(chunk);
    if(!chunks.every(path=>state.clear(path,width)))return false;
    state.routes.push(...chunks.map(points=>({points,width,group,origin:'generated'})));
    indices.slice(1).forEach((j,k)=>state.used.add(indices[k]<j?`${indices[k]}:${j}`:`${j}:${indices[k]}`));accepted++;return true;
  };
  for(const p of primary)add(p.start,p.goal,p.role==='gate'?'majorRoads':'roads');
  for(const [i,pair] of [...tree,...loops].entries()) {
    const group=i<7?'roads':i%5===0?'paths':'cityStreets';add(sites[pair.i].index,sites[pair.j].index,group);
  }
  // Join synthetic lanes to actual source centerlines, not nearby raster cells.
  const retained=map.locations.filter(p=>p.category==='street'&&p.shape.kind==='polyline');
  for(const road of retained) {
    let best;
    for(const site of sites)for(let i=1;i<road.shape.points.length;i++) {
      const q=project(site.point,road.shape.points[i-1],road.shape.points[i]),d=distance(q,site.point);
      if(d>unit*5&&d<state.spacing*2.3&&(!best||d<best.d)&&state.clear([q,site.point],unit*4))best={q,site,d};
    }
    if(best)state.routes.push({points:[best.q,best.site.point],width:roadWidths[allowed.at(-1)]*unit,group:allowed.at(-1),origin:'generated'});
  }
  if(!accepted)state.warnings.push('No new streets fit on dry, accessible land. Retained streets remain available.');
  const unused=new Set();
  for(const [key,crossing] of state.crossings)if(!state.used.has(key)){unused.add(crossing.id);state.crossings.delete(key);}
  if(unused.size)map.locations=map.locations.filter(p=>!unused.has(p.id));
  state.routeMetrics={candidateSites:sites.length,intendedLoops:loops.length,acceptedRoutes:state.routes.length,totalLength:state.routes.reduce((s,r)=>s+length(r.points),0)};
}
