import { types as baseTypes } from '../generation/catalog-v2.js';
import { roots } from '../generation/wordbanks-v2.js';
import { settlementTypes } from '../generation/economy-settlements.js';
import { applyProfile, buildingFeatures, landFeatures, terrainCatalog } from './settlement-profile.js';
import { settlementGrid, neighbors } from './settlement-grid.js';
import { planDistricts, gridBoundaries } from './settlement-districts.js';
import { components } from '../local-maps/raster.js';
import { contains, boundsFor, distanceToPath } from '../geometry.js';
import { ringArea } from './geo.js';
const agriculture={farmland:['farmland','grain'],farmyard:['farmland','livestock'],meadow:['pasture','pasture'],pasture:['pasture','pasture'],orchard:['orchard','fruit'],vineyard:['vineyard','fruit']};
const hash=value=>{let n=2166136261;for(const c of value){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;};
function semanticLand(map) {
  for(const p of map.locations) {
    const use=p.worldStyle?.landuse;
    if(p.category!=='terrain')continue;
    if(use==='cemetery'){p.category='landmark';p.type='cemetery';continue;}
    if(agriculture[use]) {
      const [type]=agriculture[use];terrainCatalog(map,type,type==='farmland'?'farmland':type);
      p.type=type;p.generation={settlement:{environment:['farmland'],resources:[agriculture[use][1]]}};
    }
  }
}
function clearPlots(map,grid,profile,warnings) {
  if(!profile.landFeatures.length)return;
  const {w,h,water,roads,occupied,terrain}=grid,clear=new Uint8Array(w*h);
  // A one-cell buffer keeps simplified plot edges away from buildings and banks.
  const blocked=water.map((v,i)=>v||roads[i]||occupied[i]||terrain[i]?1:0);
  for(let i=0;i<clear.length;i++)clear[i]=!blocked[i]&&neighbors(i,w,h).every(j=>!blocked[j])?1:0;
  const {labels,items}=components(clear,w,h,Math.max(12,Math.floor(w*h*.002)));
  // Prefer usable parcels near settlement buildings rather than the biggest remote area.
  const homes=map.locations.filter(p=>p.category==='home');
  const distance=item=>Math.min(...homes.map(p=>Math.hypot(p.x/grid.sx-item.x,p.y/grid.sy-item.y)),w+h);
  items.sort((a,b)=>(distance(a)-Math.sqrt(a.size)*.1)-(distance(b)-Math.sqrt(b.size)*.1)||a.id-b.id);
  for(const type of profile.landFeatures) {
    if(map.locations.some(p=>p.type===type||type==='graveyard'&&p.type==='cemetery'))continue;
    const item=items.shift();if(!item){warnings.push(`No clear parcel was available for ${landFeatures[type].toLowerCase()}.`);continue;}
    const shapes=gridBoundaries(labels,grid,item.id);if(!shapes.length)continue;
    const shape=shapes.sort((a,b)=>Math.abs(ringArea(b.points))-Math.abs(ringArea(a.points)))[0];
    let at=labels.indexOf(item.id);const center=grid.cell((item.x+.5)*grid.sx,(item.y+.5)*grid.sy);if(labels[center]===item.id)at=center;
    // Keep an anchor inside the proposed plot after contour simplification.
    while(at<labels.length&&(labels[at]!==item.id||!contains({shape},...grid.point(at))))at++;
    if(at===labels.length){warnings.push(`Review the ${landFeatures[type].toLowerCase()} parcel in the editor.`);continue;}
    const [x,y]=grid.point(at),burial=type==='graveyard';if(!burial)terrainCatalog(map,type,type==='farmland'?'farmland':type);
    const p={id:`fantasy-${type}-${item.id}`,category:burial?'landmark':'terrain',type,district:'imported-area',x,y,shape,
      worldStyle:{kind:burial?'burial':'terrain',landuse:burial?'cemetery':type,area:Math.abs(ringArea(shape.points)),established:true},
      ...(burial?{}:{generation:{settlement:{environment:['farmland'],resources:type==='pasture'?['pasture','livestock']:type==='orchard'?['fruit','orchard']:['farmland','grain']}}})};
    map.locations.push(p);grid.polygon(shape,terrain);
  }
}
function proximity(p,q) {
  if(contains(q,p.x,p.y))return 0;
  if(q.shape?.points)return distanceToPath(q.shape.kind==='polygon'?[...q.shape.points,q.shape.points[0]]:q.shape.points,p.x,p.y);
  return Math.hypot(p.x-q.x,p.y-q.y);
}
function connectGeography(map) {
  const water=map.locations.filter(p=>p.category==='water'),terrain=map.locations.filter(p=>p.category==='terrain');
  for(const p of map.locations.filter(p=>!['water','terrain','street'].includes(p.category)))for(const [key,places] of [['water',water],['terrain',terrain]]) {
    let best,distance=Math.max(map.width,map.height)*.1;
    for(const q of places){const d=proximity(p,q);if(d<distance){best=q;distance=d;}}
    if(best) {
      p.context={...p.context,[key]:best.id};
      if(key==='terrain'&&best.generation?.settlement) {
        const inherited=map.generator.defaults.settlement,local=best.generation.settlement;
        p.generation={...p.generation,settlement:{...p.generation?.settlement,environment:[...new Set([...inherited.environment,...local.environment])],resources:[...new Set([...(inherited.resources||settlementTypes[inherited.type].resources),...local.resources])]}};
      }
    }
  }
}
function establishBuildings(map,profile,warnings) {
  let candidates=map.locations.filter(p=>p.category==='home');
  const center=[candidates.reduce((n,p)=>n+p.x,0)/Math.max(1,candidates.length),candidates.reduce((n,p)=>n+p.y,0)/Math.max(1,candidates.length)];
  const water=new Map(map.locations.filter(p=>p.category==='water').map(p=>[p.id,p]));
  for(const feature of profile.features) {
    const [category,type,label]=buildingFeatures[feature];if(map.locations.some(p=>p.type===type))continue;
    if(!baseTypes[type]) {
      map.generator.catalog ||= {};map.generator.catalog.types ||= {};
      map.generator.catalog.types[type]={...(type==='market'?baseTypes.shop:baseTypes.guild),category,label:type==='market'?'market':'adventurers’ guild',nouns:roots.map(root=>`${root} ${type==='market'?'Market':'Guildhall'}`)};
    }
    let available=candidates;
    if(feature==='harbor')available=available.filter(p=>water.has(p.context?.water)&&['river','canal','lake','sea','bay','channel','strait'].includes(water.get(p.context.water).type)&&proximity(p,water.get(p.context.water))<Math.max(map.width,map.height)*.06);
    if(!available.length){warnings.push(`No suitable mapped footprint was available for ${label.toLowerCase()}.`);continue;}
    const score=p=>{
      const [bx,by,w,h]=boundsFor(p),edge=bx<1||by<1||bx+w>map.width-1||by+h>map.height-1,central=Math.hypot(p.x-center[0],p.y-center[1])/Math.max(map.width,map.height);
      return (edge?-4:0)+(p.context?.street?2:0)+Math.min(2,Math.sqrt(w*h)/Math.max(map.width,map.height)*15)-central+(hash(`${map.generator.seed}:${feature}:${p.id}`)%1000)/10000;
    };
    const p=[...available].sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id))[0];
    p.category=category;p.type=type;p.worldStyle={...p.worldStyle,established:true};candidates=candidates.filter(q=>q!==p);
  }
  const shares={hamlet:.08,village:.12,farming_village:.12,town:.23,city:.3,metropolis:.36,port:.34,mining_outpost:.25,forest_hold:.16,fortress:.2,monastery:.12,academy:.24,caravan_stop:.3,undercity:.25};
  for(const p of candidates) {
    const nearLand=p.context?.terrain&&map.locations.find(q=>q.id===p.context.terrain),rural=nearLand&&['farmland','pasture','orchard'].includes(nearLand.type);
    const share=shares[profile.type]*(p.context?.street?1:.5)*(rural?.6:1),roll=hash(`${map.generator.seed}:building-use:${p.id}`)/4294967296;
    if(roll<share) {p.category=hash(`${map.generator.seed}:business:${p.id}`)%2?'shop':'workshop';p.type=p.category;p.worldStyle={...p.worldStyle,useAssigned:true};}
  }
  for(const p of candidates.filter(p=>p.category==='home'))if(profile.householdSize!==null)p.generation={...p.generation,demographics:{...p.generation?.demographics,population:profile.householdSize}};
}
function districtContext(map) {
  for(const district of map.districts) {
    const places=map.locations.filter(p=>p.district===district.id),land=places.filter(p=>p.category==='terrain'),waters=places.filter(p=>p.category==='water');
    const environment=new Set(),resources=new Set();
    for(const p of land) {
      if(p.type==='forest'){environment.add('woodland');resources.add('timber');}
      if(['farmland','pasture','orchard','vineyard'].includes(p.type)){environment.add('farmland');for(const r of p.generation?.settlement?.resources||[])resources.add(r);}
      if(p.type==='marsh'){environment.add('wetland');resources.add('reed');}
    }
    for(const p of waters)environment.add(['river','canal','stream'].includes(p.type)?'river':['sea','bay','channel','strait'].includes(p.type)?'coastal':'lake');
    if(environment.size||resources.size)district.generation={settlement:{environment:[...new Set([...map.generator.defaults.settlement.environment,...environment])],resources:[...new Set([...(map.generator.defaults.settlement.resources||settlementTypes[map.generator.defaults.settlement.type].resources),...resources])]}};
  }
}
export function enrichSettlement(map,input,mappedDistricts=[]) {
  const profile=applyProfile(map,input),warnings=[];semanticLand(map);
  const grid=settlementGrid(map);clearPlots(map,grid,profile,warnings);
  const result=planDistricts(map,grid,profile,mappedDistricts);warnings.push(...result.warnings);
  connectGeography(map);establishBuildings(map,profile,warnings);districtContext(map);
  map.worldImport.planning={version:1,districts:map.districts.length,established:map.locations.filter(p=>p.worldStyle?.established).map(p=>p.id),warnings};
  return map;
}
