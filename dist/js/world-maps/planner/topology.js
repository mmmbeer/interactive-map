import { union, line, lines, distance, project, midpoint, length } from './geometry.js';
import { stableId, compare, roundPoint } from './random.js';
import { addFeature } from './features.js';
import { spatialIndex } from '../decoration-geometry.js';
const ranks={majorRoads:0,roads:1,cityStreets:2,paths:3};
const pointKey=p=>p.join(',');
function nearestRoute(points,index,tolerance) {
  const mid=midpoint(points[0],points.at(-1)),found=new Set();
  for(const segment of index.query([mid[0]-tolerance,mid[1]-tolerance,tolerance*2,tolerance*2]))if(distance(mid,project(mid,segment.a,segment.b))<tolerance)found.add(segment.route);
  const owners=[...found];
  return owners.sort((a,b)=>(a.origin==='mapped'?0:1)-(b.origin==='mapped'?0:1)||(ranks[a.group]??2)-(ranks[b.group]??2)||compare(a.id||'',b.id||''));
}
function smooth(points,state,width) {
  if(points.length<3)return points;
  let result=points;
  for(let pass=0;pass<2;pass++) {
    const next=[result[0]];
    for(let i=1;i<result.length;i++) {
      const a=result[i-1],b=result[i];
      next.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75]);
    }
    next.push(result.at(-1));if(state.clear(next,width))result=next;else break;
  }
  return result;
}
export function buildStreetGraph(state,refined=false) {
  const retained=state.map.locations.filter(p=>p.category==='street'&&p.shape.kind==='polyline');
  const routes=[...retained.map(p=>({id:p.id,points:p.shape.points,width:p.shape.width,origin:p.worldStyle?.origin==='generated'?'generated':'mapped',group:p.worldStyle?.sourceGroup||'cityStreets',bridge:!!p.worldStyle?.bridge})),...state.routes];
  if(!routes.length)return {version:2,nodes:[],edges:[],components:0};
  const ordinary=routes.filter(r=>!r.bridge),noded=ordinary.length?lines(union(ordinary.map(r=>line(r.points)))):[];
  const pins=new Map(routes.filter(r=>r.bridge).flatMap(r=>[r.points[0],r.points.at(-1)]).map(p=>[pointKey(roundPoint(p,state.precision)),p]));
  const routeIndex=spatialIndex(state.map.width/32);
  for(const r of ordinary)for(let i=1;i<r.points.length;i++) {
    const a=r.points[i-1],b=r.points[i];
    routeIndex.add({route:r,a,b},[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1])]);
  }
  const atomic=[],nodes=new Map();
  const add=points=>{
    for(let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i],cuts=[a,b,...[...pins.values()].filter(p=>distance(p,project(p,a,b))<state.precision*2)].sort((p,q)=>distance(a,p)-distance(a,q));
      for(let j=1;j<cuts.length;j++) {
        const pair=[cuts[j-1],cuts[j]],owners=nearestRoute(pair,routeIndex,state.precision*4);
        if(!owners.length||distance(...pair)<state.precision)continue;
        const keys=pair.map(p=>pointKey(roundPoint(p,state.precision)));
        const edge={points:pair,keys,owners,visited:false};atomic.push(edge);
        keys.forEach((k,j)=>{if(!nodes.has(k))nodes.set(k,{point:pair[j],edges:[]});nodes.get(k).edges.push(edge);});
      }
    }
  };
  noded.forEach(add);
  const signature=edge=>`${edge.owners[0].origin}:${edge.owners[0].group}:${edge.owners[0].width}`;
  const edges=[];
  const junction=k=>nodes.get(k).edges.length!==2||pins.has(k);
  const ordered=[...atomic.filter(e=>e.keys.some(junction)),...atomic];
  for(const first of ordered) {
    if(first.visited)continue;
    let start=first.keys.find(junction)||first.keys[0],at=start,edge=first,path=[nodes.get(start).point],owners=new Set();
    while(edge&&!edge.visited) {
      edge.visited=true;edge.owners.forEach(r=>owners.add(r));at=edge.keys[0]===at?edge.keys[1]:edge.keys[0];path.push(nodes.get(at).point);
      const options=nodes.get(at).edges;edge=!junction(at)?options.find(e=>!e.visited&&signature(e)===signature(first)):null;
    }
    const chosen=first.owners[0],mapped=[...owners].filter(r=>r.origin==='mapped');
    // Only degree-two chains bend. Junctions and all imported geometry stay fixed.
    if(!mapped.length&&!refined)path=smooth(path,state,chosen.width);
    if(path[0][0]>path.at(-1)[0]||path[0][0]===path.at(-1)[0]&&path[0][1]>path.at(-1)[1])path.reverse();
    const id=stableId('edge',path.map(p=>p.map(v=>Math.round(v*state.map.measurement.metersPerPixel*100))));
    let streetIds=mapped.map(r=>r.id).sort(compare);
    if(!streetIds.length) {
      const feature=addFeature(state,chosen.group,chosen.group==='paths'?'trail':'street',{kind:'polyline',points:path,width:chosen.width},{graphEdge:id});
      streetIds=[feature.id];
    }
    edges.push({id,from:pointKey(roundPoint(path[0],state.precision)),to:pointKey(roundPoint(path.at(-1),state.precision)),points:path,width:chosen.width,streetIds,source:mapped.length?'mapped':'generated'});
  }
  for(const r of routes.filter(r=>r.bridge))edges.push({id:stableId('bridge',r.id),from:pointKey(roundPoint(r.points[0],state.precision)),to:pointKey(roundPoint(r.points.at(-1),state.precision)),points:r.points,width:r.width,streetIds:[r.id],source:r.origin,bridge:true});
  // Curve relaxation may introduce crossings. Re-node once after relaxation.
  if(!refined&&state.routes.length) {
    state.routes=edges.filter(e=>e.source==='generated'&&!e.bridge).map(e=>({points:e.points,width:e.width,group:state.map.locations.find(p=>p.id===e.streetIds[0]).worldStyle.sourceGroup,origin:'generated'}));
    state.map.locations=state.map.locations.filter(p=>!(p.category==='street'&&p.worldStyle?.layoutVersion===2&&!p.worldStyle.bridge));
    return buildStreetGraph(state,true);
  }
  edges.sort((a,b)=>compare(a.id,b.id));
  const used=new Map();for(const e of edges)for(const [key,point] of [[e.from,e.points[0]],[e.to,e.points.at(-1)]])if(!used.has(key))used.set(key,{id:stableId('node',point.map(v=>Math.round(v*state.map.measurement.metersPerPixel*100))),point,edges:[]});
  for(const e of edges){used.get(e.from).edges.push(e.id);used.get(e.to).edges.push(e.id);e.from=used.get(e.from).id;e.to=used.get(e.to).id;}
  let components=0;const seen=new Set(),byId=new Map(edges.map(e=>[e.id,e])),byNode=new Map([...used.values()].map(n=>[n.id,n]));
  for(const n of used.values())if(!seen.has(n.id)){components++;const todo=[n.id];while(todo.length){const id=todo.pop();if(seen.has(id))continue;seen.add(id);for(const key of byNode.get(id).edges){const e=byId.get(key);todo.push(e.from,e.to);}}}
  return {version:2,nodes:[...used.values()].sort((a,b)=>compare(a.id,b.id)),edges,components,totalLength:edges.reduce((s,e)=>s+length(e.points),0)};
}
