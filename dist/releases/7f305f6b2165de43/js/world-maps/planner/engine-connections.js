import { buildStreetGraph } from './topology.js';
import { distance,project,shapeGeometry,intersect,area,line,buffer } from './geometry.js';
// Repair upstream near-miss entrances and disconnected runs before buildings
// enter the map. Existing footprint proposals are hard obstacles for repairs.
export function connectEngineStreets(state,graph) {
  if(graph.components<2)return graph;
  const buildings=(state.physicalBuildings||[]).map(b=>shapeGeometry({kind:'polygon',points:b.ring}));
  let repairs=0;
  for(let pass=0;pass<12&&graph.components>1;pass++) {
    const byNode=new Map(graph.nodes.map(n=>[n.id,n])),byEdge=new Map(graph.edges.map(e=>[e.id,e])),groups=new Map();let group=0;
    for(const node of graph.nodes)if(!groups.has(node.id)) {
      const todo=[node.id];
      while(todo.length){const id=todo.pop();if(groups.has(id))continue;groups.set(id,group);for(const key of byNode.get(id).edges){const e=byEdge.get(key);todo.push(e.from,e.to);}}
      group++;
    }
    const candidates=[];
    for(const node of graph.nodes)for(const edge of graph.edges) {
      if(groups.get(node.id)===groups.get(edge.from)||edge.bridge)continue;
      for(let i=1;i<edge.points.length;i++) {
        const q=project(node.point,edge.points[i-1],edge.points[i]),d=distance(node.point,q);
        if(d>state.precision&&d*state.map.measurement.metersPerPixel<55)candidates.push({a:node.point,b:q,d});
      }
    }
    candidates.sort((a,b)=>a.d-b.d||a.a[0]-b.a[0]||a.a[1]-b.a[1]);
    let selected;
    for(const c of candidates) {
      const width=1.2/state.map.measurement.metersPerPixel,corridor=buffer(line([c.a,c.b]),width/2);
      if(state.clear([c.a,c.b],width)&&buildings.every(b=>area(intersect(corridor,b))<state.precision**2*8)){selected={points:[c.a,c.b],width,group:'paths',role:'connector',origin:'generated'};break;}
    }
    if(!selected)break;
    const features=new Map(state.map.locations.map(p=>[p.id,p]));
    state.routes=graph.edges.filter(e=>!e.bridge).map(e=>({points:e.points,width:e.width,group:features.get(e.streetIds[0]).worldStyle.sourceGroup,role:e.role,origin:'generated'}));state.routes.push(selected);
    state.map.locations=state.map.locations.filter(p=>!(p.category==='street'&&p.worldStyle?.layoutVersion===4&&!p.worldStyle.bridge));
    graph=buildStreetGraph(state,true);repairs++;
  }
  state.physicalEngine.connectionRepairs=repairs;
  if(graph.components>1)state.warnings.push(`The medieval street plan has ${graph.components} separate dry networks. Terrain or occupied plots prevent a clear connection.`);
  return graph;
}
