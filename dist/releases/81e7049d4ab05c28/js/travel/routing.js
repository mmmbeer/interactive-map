import { distance, project } from './geometry.js';
class Heap {
  items=[];
  push(value) {
    const a=this.items;let i=a.length;a.push(value);
    while(i){const p=(i-1)>>1;if(a[p].cost<=value.cost)break;a[i]=a[p];i=p;}a[i]=value;
  }
  pop() {
    const a=this.items,first=a[0],last=a.pop();if(!a.length)return first;
    let i=0;
    while(i*2+1<a.length) {
      let c=i*2+1;if(c+1<a.length && a[c+1].cost<a[c].cost)c++;
      if(a[c].cost>=last.cost)break;a[i]=a[c];i=c;
    }a[i]=last;return first;
  }
}
function shortest(nodes,adj,start,end) {
  const costs=new Float64Array(nodes.length);costs.fill(Infinity);costs[start]=0;
  const previous=new Map(),heap=new Heap();heap.push({node:start,cost:0});
  while(heap.items.length) {
    const current=heap.pop();if(current.cost!==costs[current.node])continue;
    if(current.node===end)break;
    for(const edge of adj[current.node]) {
      const cost=current.cost+edge.length;
      if(cost<costs[edge.to]){costs[edge.to]=cost;previous.set(edge.to,{from:current.node,edge});heap.push({node:edge.to,cost});}
    }
  }
  if(!Number.isFinite(costs[end]))throw new Error('No connected road route joins these points. Choose another road or adjust the endpoint gap tolerance.');
  const path=[];let node=end;
  while(node!==start){const step=previous.get(node);path.push({points:[nodes[step.from],nodes[node]],roadId:step.edge.roadId,gap:step.edge.gap,length:step.edge.length});node=step.from;}
  return path.reverse();
}
export function roadRoute(graph,points,{maxSnapDistance=80}={}) {
  if(points.length<2 || points.length>40)throw new Error('Choose between 2 and 40 route stops.');
  if(!graph.edges.length)throw new Error('This map has no mapped road centerlines. Use distance measurement or add roads first.');
  const nodes=[...graph.nodes],cuts=new Map();
  const snapped=points.map(point=>{
    let best;
    graph.edges.forEach((edge,index)=>{
      const p=project(point,nodes[edge.u],nodes[edge.v]);
      if(!best || p.distance<best.distance)best={...p,index};
    });
    if(best.distance>maxSnapDistance)throw new Error('A selected stop is too far from a mapped road. Choose a point nearer a street.');
    const edge=graph.edges[best.index];let node;
    if(best.t<1e-8)node=edge.u;else if(best.t>1-1e-8)node=edge.v;
    else {
      const peers=cuts.get(best.index)||[],same=peers.find(p=>Math.abs(p.t-best.t)<1e-8);
      if(same)node=same.node;
      else {node=nodes.length;nodes.push({x:best.x,y:best.y});peers.push({t:best.t,node});cuts.set(best.index,peers);}
    }
    return {...best,node};
  });
  const adj=nodes.map(()=>[]);
  graph.edges.forEach((edge,i)=>{
    const stops=[{t:0,node:edge.u},...(cuts.get(i)||[]),{t:1,node:edge.v}].sort((a,b)=>a.t-b.t);
    for(let j=1;j<stops.length;j++) {
      const u=stops[j-1].node,v=stops[j].node,length=distance(nodes[u],nodes[v]);
      adj[u].push({...edge,length,to:v});adj[v].push({...edge,length,to:u});
    }
  });
  const parts=[];
  for(let i=1;i<points.length;i++) {
    const a=snapped[i-1],b=snapped[i];
    if(a.distance>1e-7)parts.push({points:[points[i-1],nodes[a.node]],access:true,length:a.distance});
    parts.push(...shortest(nodes,adj,a.node,b.node));
    if(b.distance>1e-7)parts.push({points:[nodes[b.node],points[i]],access:true,length:b.distance});
  }
  const steps=[];
  for(const part of parts) {
    const last=steps.at(-1);
    if(last && last.roadId===part.roadId && Boolean(last.access)===Boolean(part.access) && Boolean(last.gap)===Boolean(part.gap))last.length+=part.length;
    else steps.push({roadId:part.roadId,access:part.access,gap:part.gap,length:part.length});
  }
  return {parts,steps,length:parts.reduce((sum,p)=>sum+p.length,0),accessLength:parts.filter(p=>p.access).reduce((sum,p)=>sum+p.length,0),gapLength:parts.filter(p=>p.gap).reduce((sum,p)=>sum+p.length,0)};
}
