import { GeoJSONReader, GeoJSONWriter, UnaryUnionOp, OverlayOp, BufferOp, InteriorPointArea, GeometryFactory, polygonClipping } from '../../vendor/planner.js';
import { compare } from './random.js';
let precision=1e-5;
const factory=new GeometryFactory(),reader=new GeoJSONReader(factory);
const writer=new GeoJSONWriter();
// Generation is synchronous inside one worker. Each invocation selects its own
// physical precision before any geometry is read; it never edits source objects.
export function setPrecision(value) {precision=value;}
export const read=g=>{
  if(g.type==='Polygon'&&(!g.coordinates.length||!g.coordinates[0]?.length))return factory.createPolygon();
  return reader.read(g);
};
export const write=g=>writer.write(g);
export const empty=()=>factory.createPolygon();
export const line=points=>read({type:'LineString',coordinates:points});
export const closed=points=>[...points,points[0]];
export const polygon=points=>buffer(read({type:'Polygon',coordinates:[closed(points)]}),0);
export const rectangle=(x,y,w,h)=>polygon([[x,y],[x+w,y],[x+w,y+h],[x,y+h]]);
export function shapeGeometry(shape) {
  if(shape.kind==='polygon')return read({type:'Polygon',coordinates:[shape.points,...(shape.holes||[])].map(closed)});
  if(shape.kind==='polyline')return buffer(line(shape.points),shape.width/2);
  return empty();
}
export const collection=geoms=>read({type:'GeometryCollection',geometries:geoms.map(write)});
function coordinates(g) {
  const result=[],visit=j=>{
    if(j.type==='Polygon'&&j.coordinates[0]?.length>=4)result.push(j.coordinates);
    else if(j.type==='MultiPolygon')j.coordinates.forEach(c=>visit({type:'Polygon',coordinates:c}));
    else if(j.type==='GeometryCollection')j.geometries.forEach(visit);
  };visit(write(g));
  // Boolean inputs share one precision grid. This removes almost-identical
  // cut vertices before the sweep-line algorithm sees them again.
  return result.map(poly=>poly.map(ring=>{
    const rounded=ring.map(p=>p.map(v=>Math.round(v/precision)*precision));
    const unique=rounded.filter((p,i)=>!i||distance(p,rounded[i-1])>precision/2);
    if(unique.length&&distance(unique[0],unique.at(-1))>precision/2)unique.push(unique[0]);
    return unique;
  }).filter(r=>r.length>=4)).filter(poly=>poly.length&&poly[0].length>=4);
}
const fromPolygons=coordinates=>coordinates.length?read({type:'MultiPolygon',coordinates}):empty();
export const union=geoms=>{
  const nonempty=geoms.filter(g=>!g.isEmpty());if(!nonempty.length)return empty();
  if(nonempty.every(g=>g.getDimension()===2))return fromPolygons(polygonClipping.union(...nonempty.map(coordinates)));
  return UnaryUnionOp.union(collection(nonempty));
};
export const intersect=(a,b)=>a.getDimension()===2&&b.getDimension()===2?fromPolygons(polygonClipping.intersection(coordinates(a),coordinates(b))):OverlayOp.intersection(a,b);
export const subtract=(a,b)=>a.getDimension()===2&&b.getDimension()===2?fromPolygons(polygonClipping.difference(coordinates(a),coordinates(b))):OverlayOp.difference(a,b);
export const buffer=(g,r)=>BufferOp.bufferOp(g,r,3);
export const area=g=>g.getArea();
export const interior=g=>{const p=InteriorPointArea.getInteriorPoint(g);return p?[p.x,p.y]:null;};
export const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export const length=points=>points.slice(1).reduce((s,p,i)=>s+distance(points[i],p),0);
export const midpoint=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
export function polygons(g) {
  const result=[],visit=j=>{
    if(j.type==='Polygon'&&j.coordinates[0]?.length>=4)result.push({kind:'polygon',points:j.coordinates[0].slice(0,-1),...(j.coordinates.length>1?{holes:j.coordinates.slice(1).map(r=>r.slice(0,-1))}:{})});
    else if(j.type==='MultiPolygon')j.coordinates.forEach(c=>visit({type:'Polygon',coordinates:c}));
    else if(j.type==='GeometryCollection')j.geometries.forEach(visit);
  };visit(write(g));
  return result.sort((a,b)=>area(shapeGeometry(b))-area(shapeGeometry(a))||compare(JSON.stringify(a),JSON.stringify(b)));
}
export function lines(g) {
  const result=[],visit=j=>{
    if(j.type==='LineString')result.push(j.coordinates);
    else if(j.type==='MultiLineString')result.push(...j.coordinates);
    else if(j.type==='GeometryCollection')j.geometries.forEach(visit);
  };visit(write(g));return result;
}
export function project(p,a,b) {
  const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy,t=den?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)):0;
  return [a[0]+t*dx,a[1]+t*dy];
}
export function atDistance(points,at) {
  for(let i=1;i<points.length;i++) {const d=distance(points[i-1],points[i]);if(at<=d||i===points.length-1){const t=Math.max(0,Math.min(1,at/d));return {point:points[i-1].map((x,k)=>x+(points[i][k]-x)*t),tangent:[(points[i][0]-points[i-1][0])/d,(points[i][1]-points[i-1][1])/d]};}at-=d;}
}
export function canonicalRing(points,precision) {
  const ring=points.map(p=>p.map(v=>Math.round(v/precision)*precision)).filter((p,i,a)=>!i||distance(p,a[i-1])>precision/2);
  if(ring.length>1&&distance(ring[0],ring.at(-1))<precision)ring.pop();
  if(ring.length<3)return ring;
  const signed=ring.reduce((s,p,i)=>s+p[0]*ring[(i+1)%ring.length][1]-p[1]*ring[(i+1)%ring.length][0],0);
  if(signed<0)ring.reverse();
  let first=0;for(let i=1;i<ring.length;i++)if(ring[i][0]<ring[first][0]||ring[i][0]===ring[first][0]&&ring[i][1]<ring[first][1])first=i;
  return [...ring.slice(first),...ring.slice(0,first)];
}
export function canonicalShape(shape,precision) {
  return {...shape,points:canonicalRing(shape.points,precision),...(shape.holes?{holes:shape.holes.map(r=>canonicalRing(r,precision)).sort((a,b)=>compare(JSON.stringify(a),JSON.stringify(b)))}:{})};
}
