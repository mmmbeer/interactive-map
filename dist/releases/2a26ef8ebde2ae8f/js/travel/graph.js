import { distance, project, crossing } from './geometry.js';
const key=p=>`${Math.round(p.x*10000)},${Math.round(p.y*10000)}`;
export function buildRoadGraph(roads,{joinTolerance=3,cellSize=64}={}) {
  if(!Number.isFinite(joinTolerance) || joinTolerance<0 || joinTolerance>20)throw new Error('Road connection tolerance must be between 0 and 20 pixels.');
  const segments=[],cells=new Map();
  for(const road of roads) {
    if(road.category!=='street' || road.shape?.kind!=='polyline')continue;
    const points=road.shape.points.map(([x,y])=>({x,y}));
    for(let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i];if(distance(a,b)<1e-7)continue;
      segments.push({a,b,roadId:road.id,cuts:[{...a,t:0},{...b,t:1}]});
    }
  }
  const links=[];
  segments.forEach((s,i)=>{
    const {a,b}=s,candidates=new Set();
    const left=Math.floor((Math.min(a.x,b.x)-joinTolerance)/cellSize),right=Math.floor((Math.max(a.x,b.x)+joinTolerance)/cellSize);
    const top=Math.floor((Math.min(a.y,b.y)-joinTolerance)/cellSize),bottom=Math.floor((Math.max(a.y,b.y)+joinTolerance)/cellSize);
    for(let x=left;x<=right;x++)for(let y=top;y<=bottom;y++)for(const j of cells.get(`${x},${y}`)||[])candidates.add(j);
    for(const j of candidates) {
      const other=segments[j],hit=crossing(a,b,other.a,other.b);
      if(hit){s.cuts.push(hit);other.cuts.push({...hit,t:hit.u});}
      // Connect small surveyed endpoint gaps. Never bridge disconnected districts.
      for(const [from,to] of [[s,other],[other,s]])for(const [p,t] of [[from.a,0],[from.b,1]]) {
        const q=project(p,to.a,to.b);
        if(q.distance<=joinTolerance+1e-7) {
          from.cuts.push({...p,t});to.cuts.push(q);
          if(q.distance>1e-7)links.push({a:p,b:q,roadId:from.roadId,gap:true});
        }
      }
    }
    for(let x=left;x<=right;x++)for(let y=top;y<=bottom;y++) {
      const id=`${x},${y}`;if(!cells.has(id))cells.set(id,[]);cells.get(id).push(i);
    }
  });
  const nodes=[],nodeIndex=new Map(),edges=[],seen=new Set();
  const node=p=>{const k=key(p);if(!nodeIndex.has(k)){nodeIndex.set(k,nodes.length);nodes.push({x:p.x,y:p.y});}return nodeIndex.get(k);};
  const edge=(a,b,roadId,gap=false)=>{
    const u=node(a),v=node(b),k=u<v?`${u}:${v}`:`${v}:${u}`;
    if(u===v || seen.has(k))return;seen.add(k);
    edges.push({u,v,roadId,gap,length:distance(a,b)});
  };
  for(const s of segments) {
    s.cuts.sort((a,b)=>a.t-b.t);
    for(let i=1;i<s.cuts.length;i++)edge(s.cuts[i-1],s.cuts[i],s.roadId);
  }
  for(const link of links)edge(link.a,link.b,link.roadId,true);
  return {nodes,edges};
}
