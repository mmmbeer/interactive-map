import { contains } from '../../geometry.js';
import { interior, distance, project, length, line, buffer, subtract, area, atDistance } from './geometry.js';
import { buildStreetGraph } from './topology.js';
import { randomFor } from './random.js';
export function cutAlleys(state,graph,needs) {
  if(!needs('paths'))return graph;
  const {unit,map}=state,random=randomFor(map,'block-alleys'),routes=[];
  const limit=Math.max(2,Math.min(24,Math.ceil(state.buildingTarget/32)));
  for(const block of state.blocks) {
    if(routes.length>=limit)break;
    const center=interior(block.geometry);if(!center)continue;
    const entrances=[];
    for(const edge of graph.edges.filter(e=>!e.bridge&&e.role!=='alley')) {
      let best;
      for(let i=1;i<edge.points.length;i++) {
        const point=project(center,edge.points[i-1],edge.points[i]),d=distance(center,point);
        if(!best||d<best.d)best={edge,point,d};
      }
      if(best&&best.d>unit*14&&best.d<unit*230)entrances.push(best);
    }
    entrances.sort((a,b)=>a.d-b.d);
    let selected;
    for(const a of entrances)for(const b of entrances) {
      if(a===b||a.edge.id===b.edge.id)continue;
      const cosine=((a.point[0]-center[0])*(b.point[0]-center[0])+(a.point[1]-center[1])*(b.point[1]-center[1]))/(a.d*b.d);
      if(cosine>-.3)continue;
      const bend=[center[0]+(random()-.5)*unit*10,center[1]+(random()-.5)*unit*10];
      if(!contains({shape:block.shape},...bend))continue;
      const points=Array.from({length:17},(_,i)=>{const t=i/16;return a.point.map((v,k)=>(1-t)**2*v+2*(1-t)*t*bend[k]+t*t*b.point[k]);});
      const width=unit*(1.8+random()*.8),total=length(points),start=a.edge.width/2+unit*4,end=total-b.edge.width/2-unit*4;
      if(end<=start)continue;
      const inside=Array.from({length:17},(_,i)=>atDistance(points,start+(end-start)*i/16).point);
      if(!state.clear(points,width)||area(subtract(buffer(line(inside),width),block.geometry))>state.precision**2*16)continue;
      const score=a.d+b.d;
      if(!selected||score<selected.score)selected={points,width,group:'paths',origin:'generated',role:'alley',score};
    }
    if(selected)routes.push(selected);
  }
  if(!routes.length)return graph;
  const byId=new Map(map.locations.map(p=>[p.id,p]));
  state.routes=graph.edges.filter(e=>e.source==='generated'&&!e.bridge).map(e=>({points:e.points,width:e.width,group:byId.get(e.streetIds[0]).worldStyle.sourceGroup,origin:'generated',role:e.role}));
  state.routes.push(...routes);
  map.locations=map.locations.filter(p=>!(p.category==='street'&&p.worldStyle?.layoutVersion===state.layoutVersion&&!p.worldStyle.bridge));
  // Earlier streets are already relaxed. Re-node their exact shapes once more
  // so alley mouths become shared junctions without moving existing streets.
  return buildStreetGraph(state,true);
}
