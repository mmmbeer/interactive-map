// Reconcile cartographic fragments before generating names or building indexes.
import { unionTileRings } from './tile-seams.js';
import { ringArea } from './geo.js';
import { contains, ringContains } from '../geometry.js';
const precision=1e6;
const rounded=ring=>ring.map(([x,y])=>[Math.round(x*precision)/precision,Math.round(y*precision)/precision]);
const area=p=>Math.abs(ringArea(p.shape.points));
const length=p=>p.shape.points.slice(1).reduce((n,b,i)=>n+Math.hypot(b[0]-p.shape.points[i][0],b[1]-p.shape.points[i][1]),0);
const preferred=(a,b)=>((b.shape.kind==='polygon'?area(b):length(b))-(a.shape.kind==='polygon'?area(a):length(a)))||a.id.localeCompare(b.id);
const key=p=>JSON.stringify([p.type,p.worldStyle.sourceName||'']);
const eligible=p=>p.category==='water'&&p.worldStyle&&p.id.startsWith('osm-')&&!p.overrides&&!p.generation;
function polygons(places,aliases) {
  // Normalized winding and rounded coordinates cancel shared edges from different IDs.
  const originals=new Map();
  for(const p of places)for(const r of [p.shape.points,...(p.shape.holes||[])])for(const point of r)originals.set(rounded([point])[0].join(','),point);
  const restore=r=>r.map(p=>originals.get(p.join(','))||p);
  const rings=places.flatMap(p=>[p.shape.points,...(p.shape.holes||[])].map((r,i)=>{
    const points=rounded(r);return (ringArea(points)>0)===(i===0)?points:points.reverse();
  }));
  const result=unionTileRings(rings,0),outer=result.filter(r=>ringArea(r)>0),holes=result.filter(r=>ringArea(r)<0);
  return outer.map(points=>{
    const exclusions=holes.filter(r=>r.every(([x,y])=>ringContains(points,x,y)));
    const shape={kind:'polygon',points,...(exclusions.length?{holes:exclusions}:{})};
    const body={shape},members=places.filter(p=>rounded(p.shape.points).every(([x,y])=>contains(body,x,y))).sort(preferred);
    const survivor=members[0];
    if(!survivor)throw new Error('Water boundary lost its source.');
    for(const p of members)aliases[p.id]=survivor.id;
    return {...survivor,shape:{...shape,points:restore(points),...(exclusions.length?{holes:exclusions.map(restore)}:{})},worldStyle:{...survivor.worldStyle,area:Math.abs(ringArea(points))-exclusions.reduce((n,r)=>n+Math.abs(ringArea(r)),0)}};
  });
}
const pointKey=p=>p.join(',');
function lines(places,aliases) {
  const ends=new Map(),remaining=new Set(places),result=[];
  for(const p of places)for(const end of [p.shape.points[0],p.shape.points.at(-1)]) {
    const k=pointKey(end);if(!ends.has(k))ends.set(k,[]);ends.get(k).push(p);
  }
  for(const p of places) {
    if(!remaining.delete(p))continue;
    let points=p.shape.points.slice();const members=[p];
    for(const front of [false,true])while(true) {
      const end=front?points[0]:points.at(-1),neighbors=ends.get(pointKey(end));
      // Branches remain separate. Do not guess which tributary continues the river.
      if(neighbors?.length!==2)break;
      const next=neighbors.find(q=>remaining.has(q));if(!next||next.shape.width!==p.shape.width)break;
      let part=next.shape.points;
      if(pointKey(part[front?0:part.length-1])===pointKey(end))part=[...part].reverse();
      points=front?part.slice(0,-1).concat(points):points.concat(part.slice(1));
      remaining.delete(next);members.push(next);
    }
    const survivor=members.sort(preferred)[0];for(const q of members)aliases[q.id]=survivor.id;
    result.push({...survivor,shape:{...survivor.shape,points}});
  }
  return result;
}
function covered(line,body) {
  const xs=body.shape.points.map(p=>p[0]),ys=body.shape.points.map(p=>p[1]);
  const left=Math.min(...xs)-1e-6,right=Math.max(...xs)+1e-6,top=Math.min(...ys)-1e-6,bottom=Math.max(...ys)+1e-6;
  if(line.shape.points.some(([x,y])=>x<left||x>right||y<top||y>bottom))return false;
  // Check every boundary crossing, including islands. Vertex-only tests lose bends
  // crossing dry land. Midpoints of intersection intervals prove full coverage.
  const rings=[body.shape.points,...(body.shape.holes||[])];
  for(let i=1;i<line.shape.points.length;i++) {
    const a=line.shape.points[i-1],b=line.shape.points[i],dx=b[0]-a[0],dy=b[1]-a[1],stops=[0,1];
    for(const ring of rings)for(let j=0;j<ring.length;j++) {
      const c=ring[j],d=ring[(j+1)%ring.length],ex=d[0]-c[0],ey=d[1]-c[1],den=dx*ey-dy*ex;
      if(Math.abs(den)<1e-10)continue;
      const cx=c[0]-a[0],cy=c[1]-a[1],t=(cx*ey-cy*ex)/den,u=(cx*dy-cy*dx)/den;
      if(t>0&&t<1&&u>=0&&u<=1)stops.push(t);
    }
    stops.sort((a,b)=>a-b);
    for(let j=1;j<stops.length;j++) {
      const t=(stops[j-1]+stops[j])/2;
      if(!contains(body,a[0]+dx*t,a[1]+dy*t))return false;
    }
  }
  return true;
}
export function reconcileWater(map) {
  const groups=new Map(),aliases={...map.locationAliases},replacements=new Map(),removed=new Set();
  for(const p of map.locations.filter(eligible)) {
    if(!['polygon','polyline'].includes(p.shape?.kind))continue;
    const k=key(p);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(p);
  }
  for(const places of groups.values()) {
    const areas=places.filter(p=>p.shape.kind==='polygon'),paths=places.filter(p=>p.shape.kind==='polyline');
    let bodies;
    try {const redirects={};bodies=polygons(areas,redirects);Object.assign(aliases,redirects);}catch {bodies=areas;} // Keep input intact if boundaries cannot be stitched.
    const joined=lines(paths,aliases),kept=[];
    for(const line of joined) {
      const body=bodies.find(p=>covered(line,p));
      if(body)aliases[line.id]=body.id;else kept.push(line);
    }
    for(const p of places)removed.add(p.id);
    for(const p of [...bodies,...kept])replacements.set(p.id,p);
  }
  // Flatten redirects so old fragment links and contextual references still resolve.
  for(const id of Object.keys(aliases)) {
    let target=aliases[id];const seen=new Set([id]);
    while(aliases[target]&&aliases[target]!==target&&!seen.has(target)){seen.add(target);target=aliases[target];}
    if(id===target)delete aliases[id];else aliases[id]=target;
  }
  const locations=map.locations.flatMap(p=>replacements.has(p.id)?[replacements.get(p.id)]:removed.has(p.id)?[]:[p]).map(p=>p.context?{...p,context:Object.fromEntries(Object.entries(p.context).map(([k,id])=>[k,aliases[id]||id]))}:p);
  return {...map,locations,...(Object.keys(aliases).length?{locationAliases:aliases}:{}),worldImport:{...map.worldImport,waterVersion:1}};
}
export function upgradeWorldWater(map) {
  return map.worldImport&&map.worldImport.waterVersion===undefined?reconcileWater(map):map;
}
export function resolveLocationId(map,id) {return map.locationAliases?.[id]||id;}
