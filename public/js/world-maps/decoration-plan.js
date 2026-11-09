import { boundsFor, contains } from '../geometry.js';
import { decorationSpace, fits, spatialIndex } from './decoration-geometry.js';
import { terrainNoise, scatterProbability } from './decoration-noise.js';
export function seededRandom(value) {
  let n=2166136261;for(const c of String(value)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}
  return ()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
}
export function biomeFor(p) {
  const use=p.worldStyle?.landuse;
  if(['cemetery','graveyard'].includes(p.type)||use==='cemetery')return 'burial';
  if(p.type==='marsh'||['wetland','swamp','marsh'].includes(use))return 'wetland';
  if(p.type==='orchard'||use==='orchard')return 'orchard';
  if(['farmland','farmyard','vineyard'].includes(use))return 'crops';
  if(p.type==='scrubland')return 'scrub';
  if(p.type==='forest')return use==='scrub'?'scrub':'forest';
  if(['park','garden','nature_reserve','national_park'].includes(use))return 'park';
  if(p.category==='terrain'&&['field','pasture','grassland','meadow','common','lakeshore','riverbank','shore'].includes(p.type))return 'meadow';
  return null;
}
const treeKinds=['bush','bush','bush','pine','pineLarge','broadleaf'];
const pick=(rand,items)=>items[Math.floor(rand()*items.length)];
function appearance(biome,rand,unit) {
  const kind=biome==='burial'?'graves':biome==='wetland'?pick(rand,['reeds','reeds','ripples','bush']):
    biome==='forest'||biome==='orchard'?pick(rand,treeKinds):biome==='park'?pick(rand,['bush','broadleaf','grass']):
    biome==='scrub'?pick(rand,['bush','grass','rocksLow']):pick(rand,['grass','grass','grass','rocks']);
  const tree=treeKinds.includes(kind),size=(kind==='graves'?27+rand()*9:tree?20+rand()*13:11+rand()*8)*unit;
  return {kind,size,angle:(rand()-.5)*(kind==='bush'?.9:.2),flip:rand()<.5?-1:1};
}
export function markBounds(mark,padding=0) {
  const r=mark.size*(Math.abs(Math.cos(mark.angle))+Math.abs(Math.sin(mark.angle)))/2+padding;
  return [mark.x-r,mark.y-r,r*2,r*2];
}
export function markCollisionBounds(mark) {
  const box=markBounds(mark),factor=treeKinds.includes(mark.kind)?.64:['grass','reeds'].includes(mark.kind)?.75:1;
  const w=box[2]*factor,h=box[3]*factor;
  return [mark.x-w/2,mark.y-h/2,w,h];
}
// Geometry only. Resolution-independent plans are shared by preview and export.
// Decorative marks never become locations or change surveyed geometry or IDs.
export async function planDecorations(map,{trees=[],treeDensity=1,signal}={}) {
  const unit=map.width/4096,space=decorationSpace(map,unit),marks=[],land=spatialIndex(128*unit);
  const seed=`${map.generationId}:${map.generator?.seed||''}:ink-v2`,field=terrainNoise(seed,unit);
  const places=[...map.locations].sort((a,b)=>a.id.localeCompare(b.id));
  let attempts=0;
  const density=Math.max(0,Math.min(2,Number(treeDensity)||0));
  async function checkpoint() {
    signal?.throwIfAborted();if(++attempts%512===0){await new Promise(r=>setTimeout(r,0));signal?.throwIfAborted();}
  }
  const place=(mark,region,onWater=false)=>{
    if(marks.length>=14000)return false;
    const box=markBounds(mark,unit),collision=markCollisionBounds(mark);
    if(region&&!fits(region,box)||!space.free(box,onWater,collision))return false;
    marks.push(mark);space.claim(collision);return true;
  };
  // Preserve individual mapped trees, but leave roads, roofs and water clear.
  if(density)for(const [x,y] of [...trees].sort((a,b)=>a[1]-b[1]||a[0]-b[0]).slice(0,14000)) {
    await checkpoint();const rand=seededRandom(`${seed}:tree:${x}:${y}`);
    place({x,y,...appearance('forest',rand,unit),mapped:true});
  }
  // Boats belong to navigable water near a mapped or established harbor.
  const navigable=new Set(['river','canal','lake','sea','bay','channel','strait']);
  for(const p of places.filter(p=>p.category==='harbor'||['harbor','port','ferry'].includes(p.type)).slice(0,120)) {
    const rand=seededRandom(`${seed}:harbor:${p.id}`);
    let added=0;
    for(let i=0;i<90&&added<3&&attempts<65000&&marks.length<14000;i++) {
      await checkpoint();const radius=(18+rand()*220)*unit,angle=rand()*Math.PI*2;
      const mark={x:p.x+Math.cos(angle)*radius,y:p.y+Math.sin(angle)*radius,size:(26+rand()*14)*unit,kind:added?'ripples':'ship',angle:(rand()-.5)*.15,flip:rand()<.5?-1:1,harbor:p.id};
      const box=markBounds(mark,unit);
      if(space.waterAt(box).some(q=>navigable.has(q.type)&&fits(q,box))&&place(mark,null,true))added++;
    }
  }
  for(const p of space.waters.filter(p=>p.shape?.kind==='polygon')) {
    const [x,y,w,h]=boundsFor(p),rand=seededRandom(`${seed}:water:${p.id}`);
    const count=Math.min(250,Math.ceil(w*h/(30000*unit*unit)));
    for(let i=0;i<count&&attempts<65000&&marks.length<14000;i++) {
      await checkpoint();
      const px=x+rand()*w,py=y+rand()*h,patch=field(px,py);
      if(rand()>scatterProbability('water',patch.coverage))continue;
      place({x:px,y:py,kind:'ripples',size:(18+rand()*14)*unit*patch.scale,angle:0,water:p.id},p,true);
    }
  }
  for(const p of places) {
    const biome=biomeFor(p);if(!biome||p.shape?.kind!=='polygon')continue;
    const bounds=boundsFor(p);land.add(p,bounds);
    if(biome==='crops')continue;
    if(['forest','orchard','park','scrub'].includes(biome)&&!density)continue;
    const [x,y,w,h]=bounds,rand=seededRandom(`${seed}:${p.id}`);
    const frequency=['forest','scrub','park','orchard'].includes(biome)?density:1;
    const count=Math.ceil(Math.min(6000,w*h/(220*unit*unit))*frequency);
    for(let i=0;i<count&&attempts<65000&&marks.length<14000;i++) {
      await checkpoint();const px=x+rand()*w,py=y+rand()*h;
      const patch=field(px,py);
      if(rand()>scatterProbability(biome,patch.coverage))continue;
      const mark={x:px,y:py,...appearance(biome,rand,unit),region:p.id};
      mark.size*=patch.scale;
      if(!density&&mark.kind==='bush')mark.kind='reeds';
      if(biome==='orchard') {
        // Orchard rows retain human order, with small spacing and size variations.
        const gap=32*unit;mark.x=x+(Math.floor((px-x)/gap)+.5)*gap+(rand()-.5)*4*unit;
        mark.y=y+(Math.floor((py-y)/gap)+.5)*gap+(rand()-.5)*4*unit;
      }
      place(mark,p);
    }
  }
  // Sparse meadow details give unclassified open land a little texture without
  // inventing a forest, cemetery or settlement where the source has none.
  const rand=seededRandom(`${seed}:open-land`);
  for(let i=0;i<2800&&attempts<65000&&marks.length<14000;i++) {
    await checkpoint();const x=rand()*map.width,y=rand()*map.height;
    if([...land.query([x,y,0,0])].some(p=>contains(p,x,y)))continue;
    const environment=map.generator?.defaults?.settlement?.environment||[];
    const biome=environment.includes('wetland')?'wetland':environment.includes('woodland')?'scrub':'meadow';
    const patch=field(x,y);
    if(rand()>scatterProbability(biome,patch.coverage)*.65)continue;
    const mark={x,y,...appearance(biome,rand,unit),ambient:true};
    if(biome==='meadow'&&density&&rand()<.18)Object.assign(mark,{kind:'bush',size:(16+rand()*8)*unit});
    if(!density&&mark.kind==='bush')mark.kind='grass';
    mark.size*=patch.scale;
    place(mark);
  }
  signal?.throwIfAborted();return marks.sort((a,b)=>a.y-b.y||a.x-b.x);
}
