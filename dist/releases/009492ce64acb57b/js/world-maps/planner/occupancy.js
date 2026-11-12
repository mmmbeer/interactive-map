import { contains } from '../../geometry.js';
import { MinHeap } from '../settlement-grid.js';
import { distance, length, interior } from './geometry.js';
import { planBlocks } from './parcels.js';
// Retain occupied streets and the routes that connect them to the settlement.
// Empty duplicate loops and speculative cul-de-sacs do not survive this pass.
export function trimUnoccupiedStreets(state,graph) {
  if(!state.buildingCount||!graph.nodes.length)return graph;
  const byEdge=new Map(graph.edges.map(e=>[e.id,e])),byNode=new Map(graph.nodes.map(n=>[n.id,n]));
  const core=state.anchors.find(a=>a.role==='market')?.point||graph.nodes[0].point;
  const root=[...graph.nodes].sort((a,b)=>distance(a.point,core)-distance(b.point,core))[0];
  const cost=new Map([[root.id,0]]),previous=new Map(),heap=new MinHeap();heap.push([0,root.id]);
  while(heap.items.length) {
    const [d,id]=heap.pop();if(d!==cost.get(id))continue;
    for(const key of byNode.get(id).edges) {
      const edge=byEdge.get(key),next=edge.from===id?edge.to:edge.from,value=d+length(edge.points);
      if(value>=(cost.get(next)??Infinity))continue;
      cost.set(next,value);previous.set(next,edge);heap.push([value,next]);
    }
  }
  const occupied=new Set(state.parcels.filter(p=>p.building).map(p=>p.edge)),keep=new Set(occupied);
  for(const e of graph.edges)if(e.source==='mapped'||e.role==='alley')keep.add(e.id);
  for(const id of [...keep])for(let node of [byEdge.get(id).from,byEdge.get(id).to]) {
    while(previous.has(node)){const e=previous.get(node);keep.add(e.id);node=e.from===node?e.to:e.from;}
  }
  const removed=graph.edges.filter(e=>!keep.has(e.id)),removeIds=new Set(removed.flatMap(e=>e.streetIds));
  // A retained source feature can belong to several graph spans.
  const retainedIds=new Set(graph.edges.filter(e=>keep.has(e.id)).flatMap(e=>e.streetIds));
  state.map.locations=state.map.locations.filter(p=>!removeIds.has(p.id)||retainedIds.has(p.id)||p.worldStyle?.origin!=='generated');
  graph.edges=graph.edges.filter(e=>keep.has(e.id));
  graph.nodes=graph.nodes.map(n=>({...n,edges:n.edges.filter(id=>keep.has(id))})).filter(n=>n.edges.length);
  graph.totalLength=graph.edges.reduce((s,e)=>s+length(e.points),0);
  graph.components=0;const seen=new Set();
  for(const n of graph.nodes)if(!seen.has(n.id)) {
    graph.components++;const todo=[n.id];
    while(todo.length){const id=todo.pop();if(seen.has(id))continue;seen.add(id);for(const key of byNode.get(id).edges.filter(k=>keep.has(k))){const e=byEdge.get(key);todo.push(e.from,e.to);}}
  }
  state.parcels=state.parcels.filter(p=>keep.has(p.edge));planBlocks(state,graph);
  const buildings=new Map(state.map.locations.filter(p=>p.worldStyle?.kind==='building').map(p=>[p.id,p]));
  for(const plot of state.parcels) {
    const point=interior(plot.geometry),block=state.blocks.find(b=>contains({shape:b.shape},...point));
    if(block){plot.block=block.id;const home=buildings.get(plot.building);if(home)home.worldStyle.block=block.id;}
  }
  state.routeMetrics={...state.routeMetrics,totalLength:graph.totalLength,removedEmptyStreets:removed.length,occupiedStreets:occupied.size,alleys:graph.edges.filter(e=>e.role==='alley').length};
  return graph;
}
