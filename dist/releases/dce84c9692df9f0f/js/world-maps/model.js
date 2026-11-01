import { imageProjection, clipRing, clipLines, checkArea, ringArea } from './geo.js';
import { coordinates, polygons, featureKind } from './osm.js';
import { coastalWater } from './coast.js';
import { ringContains, distanceToPath } from '../geometry.js';
import { validateMap } from '../map-contract.js';
import { numberSites } from '../site-index.js';
export function hash(value) {let n=2166136261;for(const c of String(value)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
function anchor(points,holes=[]) {
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),left=Math.min(...xs),top=Math.min(...ys),w=Math.max(...xs)-left,h=Math.max(...ys)-top;
  const center=[left+w/2,top+h/2],inside=([x,y])=>ringContains(points,x,y)&&!holes.some(r=>ringContains(r,x,y));
  if(inside(center))return center;
  for(let y=1;y<10;y++)for(let x=1;x<10;x++){const p=[left+w*x/10,top+h*y/10];if(inside(p))return p;}
  return points[0];
}
function terrainType(t) {
  if(t.natural==='wetland')return 'marsh';
  if(['forest','orchard'].includes(t.landuse)||['wood','scrub'].includes(t.natural))return 'forest';
  return 'field';
}
function roadMeters(t) {
  const given=parseFloat(t.width);if(Number.isFinite(given)&&given>0)return Math.min(35,given);
  return {motorway:16,trunk:12,primary:10,secondary:8,tertiary:7,residential:6,service:4,footway:2,path:2,steps:2,track:3}[t.highway]||5;
}
function linkStreets(map) {
  const size=map.width/24,bins=new Map(),roads=map.locations.filter(p=>p.category==='street');
  for(const r of roads)for(let i=1;i<r.shape.points.length;i++) {
    const a=r.shape.points[i-1],b=r.shape.points[i],steps=Math.min(100,Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/size)));
    for(let j=0;j<=steps;j++) {
      const key=`${Math.floor((a[0]+(b[0]-a[0])*j/steps)/size)},${Math.floor((a[1]+(b[1]-a[1])*j/steps)/size)}`;
      if(!bins.has(key))bins.set(key,new Set());bins.get(key).add(r);
    }
  }
  for(const p of map.locations.filter(p=>p.category==='home')) {
    const x=Math.floor(p.x/size),y=Math.floor(p.y/size),candidates=new Set();
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const r of bins.get(`${x+dx},${y+dy}`)||[])candidates.add(r);
    let best,distance=size*2;
    for(const r of candidates){const d=distanceToPath(r.shape.points,p.x,p.y);if(d<distance){best=r;distance=d;}}
    if(best)p.context={street:best.id};
  }
}
export function convertArea(data,{bounds,width,height,id,name,seed='world-map',settings={}}) {
  const area=checkArea(bounds),project=imageProjection(bounds,width,height),locations=[],coasts=[],trees=[];
  const mpp=area.width/width,visualScale=width/4096;
  const map={schemaVersion:2,id,generationId:`world-${hash(JSON.stringify(bounds)).toString(16)}`,name,subtitle:'A real place, reimagined',description:'Fantasy artwork derived from OpenStreetMap geometry. Building uses and stories are fictional. © OpenStreetMap contributors, ODbL 1.0.',
    image:`local/${id}/map`,thumbnail:`local/${id}/thumbnail`,width,height,theme:'Dragonsgate ink',region:'Your atlas',directoryScope:'all',tags:['world import','fantasy'],
    generator:{version:2,detailsVersion:2,socialVersion:1,proseVersion:1,seed,defaults:{demographics:{race:'human'}}},
    measurement:{metersPerPixel:mpp,unit:'m'},districts:[{id:'imported-area',name:'Imported area'}],locations,
    worldImport:{version:1,bounds,projection:'web-mercator',dataTimestamp:data.osm3s?.timestamp_osm_base||null,attribution:'© OpenStreetMap contributors',license:'https://opendatacommons.org/licenses/odbl/1-0/',source:'https://www.openstreetmap.org/copyright',settings}};
  const represented=new Set();
  for(const e of data.elements||[])if(e.type==='relation'&&polygons(e).length&&featureKind(e.tags))for(const member of e.members||[])if(member.type==='way'&&(member.role==='outer'||member.role==='inner'||!member.role))represented.add(member.ref);
  const add=(key,category,type,shape,visual)=>{
    const points=shape.points;if(!points?.length)return;
    const [x,y]=shape.kind==='polygon'?anchor(points,shape.holes):points[Math.floor(points.length/2)];
    locations.push({id:key,category,type,district:'imported-area',x,y,shape,worldStyle:visual});
  };
  for(const e of [...(data.elements||[])].sort((a,b)=>a.type.localeCompare(b.type)||a.id-b.id)) {
    const t=e.tags||{},kind=featureKind(t),key=`osm-${e.type}-${e.id}`;
    if(!kind||(e.type==='way'&&represented.has(e.id)))continue;
    if(kind==='tree'){if(Number.isFinite(e.lon)&&Number.isFinite(e.lat))trees.push(project(e.lon,e.lat));continue;}
    if(kind==='coast'){coasts.push(coordinates(e.geometry).map(p=>project(...p)));continue;}
    if(kind==='road'||kind==='river') {
      const road=kind==='road',meters=road?roadMeters(t):({river:18,canal:10,stream:3}[t.waterway]||2);
      const stroke=Math.min(Math.min(width,height)/10,Math.max(visualScale*1.5,meters/mpp*(road?(settings.roadWidth||1):1))),pad=stroke/2+.01;
      const type=road?(t.bridge==='yes'?'bridge':['path','footway','track','steps'].includes(t.highway)?'trail':'street'):(['stream','canal'].includes(t.waterway)?t.waterway:'river');
      clipLines(coordinates(e.geometry).map(p=>project(...p)),width,height,pad).forEach((points,i)=>add(`${key}-${i}`,road?'street':'water',type,{kind:'polyline',width:stroke,points},{kind,bridge:t.bridge==='yes'}));
      continue;
    }
    for(const [i,polygon] of polygons(e).entries()) {
      const points=clipRing(polygon.points.map(p=>project(...p)),width,height);if(points.length<3)continue;
      const holes=polygon.holes.map(r=>clipRing(r.map(p=>project(...p)),width,height)).filter(r=>r.length&&r.every(([x,y])=>ringContains(points,x,y)));
      const category=kind==='building'?'home':kind==='water'?'water':'terrain';
      const type=kind==='building'?'home':kind==='water'?(t.water==='pond'?'pond':t.water==='river'?'river':'lake'):terrainType(t);
      add(`${key}-${i}`,category,type,{kind:'polygon',points,...(holes.length?{holes}:{})},{kind,landuse:t.landuse||t.leisure||t.natural||'',area:Math.abs(ringArea(points))});
    }
  }
  coastalWater(coasts,width,height).forEach((shape,i)=>add(`coastal-water-${i}`,'water','sea',{kind:'polygon',...shape},{kind:'water'}));
  if(!locations.length)throw new Error('No mapped features found in this selection. Choose a built-up area or a larger selection.');
  if(locations.length>12000)throw new Error('More than 12,000 features found. Select a smaller area.');
  linkStreets(map);validateMap(map);return {map:numberSites(map),trees:trees.filter(([x,y])=>x>=0&&y>=0&&x<=width&&y<=height)};
}
