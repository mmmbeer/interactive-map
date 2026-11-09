import { boundsFor, contains, distanceToPath } from '../geometry.js';
import { ringArea } from './geo.js';
import { spatialIndex } from './decoration-geometry.js';
import { types } from '../generation/catalog-v2.js';

// Import-specific catalogs leave released generators and authored maps unchanged.
const profiles={
  grassland:['grassland','Grassland','covers open grassy ground'],
  meadow:['meadow','Meadow','forms a tract of meadowland'],
  park:['park','Park','provides green space among the surrounding streets'],
  garden:['garden','Garden','occupies a planted green space'],
  common:['open ground','Common','forms an open space in the surrounding settlement'],
  reserve:['nature reserve','Reserve','preserves a tract of natural ground'],
  scrubland:['scrubland','Scrub','is covered with low scrub'],
  lakeshore:['lakeshore','Lakeshore','follows the edge of {water}'],
  riverbank:['riverbank','Riverbank','follows the bank of {water}'],
  shore:['shore','Shore','follows the meeting of land and {water}']
};
export function parcelMetrics(shape) {
  const rings=[shape.points,...(shape.holes||[])];
  const area=Math.max(0,Math.abs(ringArea(shape.points))-(shape.holes||[]).reduce((n,r)=>n+Math.abs(ringArea(r)),0));
  const perimeter=rings.reduce((n,r)=>n+r.reduce((s,p,i)=>s+Math.hypot(p[0]-r[(i+1)%r.length][0],p[1]-r[(i+1)%r.length][1]),0),0);
  // Unlike axis-aligned bounds these measures also catch diagonal and hollow strips.
  return {area,width:perimeter?2*area/perimeter:0,compactness:perimeter?4*Math.PI*area/(perimeter*perimeter):0};
}
function boundarySamples(points,count=32) {
  const lengths=points.map((p,i)=>Math.hypot(p[0]-points[(i+1)%points.length][0],p[1]-points[(i+1)%points.length][1]));
  const step=lengths.reduce((a,b)=>a+b,0)/count,samples=[];let edge=0,start=0;
  for(let i=0;i<count;i++) {
    const at=(i+.5)*step;while(edge<points.length-1&&start+lengths[edge]<at)start+=lengths[edge++];
    const a=points[edge],b=points[(edge+1)%points.length],t=lengths[edge]?(at-start)/lengths[edge]:0;
    samples.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
  }
  return samples;
}
function waterDistance(p,x,y) {
  if(contains(p,x,y))return 0;
  const {shape}=p;
  if(shape.kind==='polyline')return Math.max(0,distanceToPath(shape.points,x,y)-shape.width/2);
  return Math.min(...[shape.points,...(shape.holes||[])].map(r=>distanceToPath([...r,r[0]],x,y)));
}
function register(map,type) {
  const [label,head,use]=profiles[type];
  map.generator.catalog ||= {};map.generator.catalog.types ||= {};
  map.generator.catalog.types[type] ||= {...types.field,label,tables:{...types.field.tables,
    name:types.field.tables.name.map(p=>typeof p==='string'?p.replaceAll('{head}',head):{...p,value:p.value.replaceAll('{head}',head)})}};
  return `{displayName} ${use}${use.includes('{water}')?'':' in {district}'}.`;
}
export function classifyTerrain(map,{eligible=()=>true}={}) {
  if(!map.worldImport)return map;
  const extent=Math.max(map.width,map.height),mpp=map.measurement?.metersPerPixel||1;
  const tolerance=Math.max(12/mpp,extent*.002),waters=spatialIndex(extent/16);
  for(const p of map.locations)if(p.category==='water'&&p.shape)waters.add(p,boundsFor(p));
  for(const p of map.locations) {
    if(p.category!=='terrain'||p.shape?.kind!=='polygon'||!eligible(p))continue;
    const use=p.worldStyle?.landuse;
    // Source agriculture, woods, wetlands and authored choices take precedence.
    if(['farmland','farmyard','pasture','orchard','vineyard','forest','wood','wetland','beach'].includes(use))continue;
    const candidate=p.type==='field'||p.type==='pasture'&&use==='meadow';
    if(!candidate||p.overrides||p.generation?.tables?.name||p.generation?.tables?.description||p.worldStyle?.established)continue;
    let type=({scrub:'scrubland',grass:'grassland',grassland:'grassland',meadow:'meadow',park:'park',garden:'garden',recreation_ground:'common',playground:'common',golf_course:'common',nature_reserve:'reserve',national_park:'reserve'})[use]||'common';
    const [x,y,w,h]=boundsFor(p),samples=boundarySamples(p.shape.points),metrics=parcelMetrics(p.shape);
    let best,hits=0;
    for(const q of waters.query([x-tolerance,y-tolerance,w+2*tolerance,h+2*tolerance])) {
      const count=samples.filter(([px,py])=>waterDistance(q,px,py)<=tolerance).length;
      if(count>hits||count===hits&&best&&q.id.localeCompare(best.id)<0){best=q;hits=count;}
    }
    // A single nearby corner does not make a parcel a shoreline. Do not infer
    // sand, wetland, elevation or cultivation from proximity alone.
    const shoreline=best&&hits>=samples.length*.25;
    if(shoreline&&['grassland','meadow','common'].includes(type)&&(metrics.width*mpp<35||metrics.compactness<.3)) {
      type=['river','stream','canal'].includes(best.type)?'riverbank':['lake','pond'].includes(best.type)?'lakeshore':'shore';
    }
    if(p.type==='pasture'&&use==='meadow'&&p.generation?.settlement) {
      const {settlement,...generation}=p.generation;p.generation=generation;
    }
    if(shoreline)p.context={...p.context,water:best.id};
    const description=register(map,type);
    p.type=type;p.generation={...p.generation,tables:{...p.generation?.tables,
      description:[description,...(shoreline&&!['lakeshore','riverbank','shore'].includes(type)?[`${description} It lies beside {water}.`]:[])]}};
  }
  map.worldImport.terrainVersion=1;return map;
}
export function upgradeLocalTerrain(record) {
  if(!record?.map.worldImport||record.map.worldImport.terrainVersion!==undefined)return record;
  const original=new Map((record.initialMap?.locations||[]).map(p=>[p.id,p]));
  const map=structuredClone(record.map);
  classifyTerrain(map,{eligible:p=>!record.initialMap||JSON.stringify(p)===JSON.stringify(original.get(p.id))});
  return {...record,map};
}
