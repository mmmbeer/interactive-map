import { connectEngineStreets } from './engine-connections.js';
import { buildStreetGraph } from './topology.js';
import { atDistance,length,distance,line,buffer,shapeGeometry,intersect,area,project } from './geometry.js';
import { blockers,routeClear } from '../procedural-space.js';
export function serviceAlleys(state,graph,needs) {
  if(!needs('paths')||!state.buildingCount||graph.edges.filter(e=>e.role==='alley').length>=Math.ceil(state.buildingCount/70))return graph;
  const mpp=state.map.measurement.metersPerPixel,homes=state.map.locations.filter(p=>p.worldStyle?.kind==='building'),space=blockers(state.map),candidates=[];
  const samples=graph.edges.filter(e=>!e.bridge&&e.role!=='alley').flatMap(edge=>[.25,.5,.75].map(t=>({edge,point:atDistance(edge.points,length(edge.points)*t).point})));
  for(let i=0;i<samples.length;i++)for(let j=i+1;j<samples.length;j++) {
    const a=samples[i],b=samples[j],d=distance(a.point,b.point)*mpp;
    if(a.edge.id===b.edge.id||d<8||d>85)continue;
    // A service lane must serve occupied ground rather than an empty shortcut.
    const mid=a.point.map((v,k)=>(v+b.point[k])/2);
    if(!homes.some(h=>Math.hypot(h.x-mid[0],h.y-mid[1])*mpp<25))continue;
    const width=1.1/mpp,points=[a.point,mid,b.point];
    if(!routeClear(points,width,space))continue;
    const g=buffer(line(points),width/2);
    if(homes.some(h=>area(intersect(g,shapeGeometry(h.shape)))>state.precision**2*8))continue;
    candidates.push({a,b,d,points,width});
  }
  candidates.sort((a,b)=>a.d-b.d||a.a.point[0]-b.a.point[0]||a.a.point[1]-b.a.point[1]);
  const selected=[],limit=Math.max(1,Math.min(8,Math.ceil(state.buildingCount/70)));
  for(const candidate of candidates) {
    if(selected.length>=limit)break;
    if(selected.some(s=>[s.a.point,s.b.point].some(p=>[candidate.a.point,candidate.b.point].some(q=>distance(p,q)*mpp<20))))continue;
    selected.push(candidate);
  }
  if(!selected.length)return graph;
  const features=new Map(state.map.locations.map(p=>[p.id,p]));
  state.routes=graph.edges.filter(e=>!e.bridge&&e.source==='generated').map(e=>({points:e.points,width:e.width,group:features.get(e.streetIds[0]).worldStyle.sourceGroup,role:e.role,origin:'generated'}));
  state.routes.push(...selected.map(s=>({points:s.points,width:s.width,group:'paths',role:'alley',origin:'generated'})));
  state.map.locations=state.map.locations.filter(p=>!(p.category==='street'&&p.worldStyle?.layoutVersion===4&&!p.worldStyle.bridge));
  graph=buildStreetGraph(state,true);graph=connectEngineStreets(state,graph);
  // Noding new mouths can split the access edge. Rebind plots and homes to
  // their actual frontage, keeping model references valid after the split.
  const homesById=new Map(homes.map(h=>[h.id,h]));
  for(const plot of state.parcels) {
    let best;
    for(const e of graph.edges)for(let i=1;i<e.points.length;i++) {
      const d=distance(plot.front,project(plot.front,e.points[i-1],e.points[i]));
      if(!best||d<best.d)best={e,d};
    }
    if(best){plot.edge=best.e.id;plot.street=best.e.streetIds[0];const h=homesById.get(plot.building);if(h)h.context={...h.context,street:plot.street};}
  }
  return graph;
}
