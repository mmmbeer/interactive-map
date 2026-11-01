import { types as defaultsV2 } from './catalog-v2.js';
import { types as defaultsV1 } from './catalog-v1.js';
import { economyTypes } from './economy-catalog.js';
import { settlementTypes } from './economy-settlements.js';
import { tradeCatalog, industries } from './economy-catalog.js';
import { choose, streams } from './helpers-v2.js';
const indexes=new WeakMap();
const waterKinds=new Set('river canal lake bay sea channel strait'.split(' '));
// Exact semantic tags avoid guessing industries from names or a resident's ancestry.
const traitSectors = {
  'grain markets':'agriculture','enclosed farm plots':'agriculture',orchards:'agriculture',gardens:'agriculture',farmland:'agriculture',
  'metalworkers':'metal','textile workshops':'textiles','weaving halls':'textiles','rope makers':'textiles',
  'glass workshops':'glass','public theatre':'arts','bathhouses':'hospitality','pilgrim lodging':'hospitality','merchant lodging':'hospitality',
  'temple precinct':'records','court officials':'records','southern civic courts':'civic','watch barracks':'metal',
  'ship chandlers':'maritime','fish auctions':'maritime','warehouses':'transport','western gate traffic':'transport'
};
const coastTraits=['coastal','trading port','rocky coast','island docks','fish auctions','waterfront households','southern island wharves','mainland quays','ship chandlers','pilots and ferries','inner harbor','eastern waterfront','small boat landings'];
const terrainEnvironments={forest:'woodland',wood:'woodland',hill:'hills',mountain:'mountain',marsh:'wetland',field:'farmland',beach:'coastal',cape:'coastal'};
const terrainResources={forest:['timber','herbs'],wood:['timber','herbs'],hill:['stone'],mountain:['stone'],marsh:['reed'],field:['farmland'],beach:['sand'],cape:['stone']};
const unique=v=>[...new Set(v)].sort();
export function economicContext(map,place,config,demographics={}) {
  let index=indexes.get(map);
  if(!index) {index=new Map(map.locations.map(p=>[p.id,p]));indexes.set(map,index);}
  const links=Object.fromEntries(Object.entries(place.context || {}).map(([k,id])=>[k,index.get(id)]));
  const type=config.settlement?.type || 'city',profile=settlementTypes[type];
  if (!profile) throw new Error(`Unknown settlement type: ${type}`);
  const traits=config.traits || [];
  const environment=[...(config.settlement?.environment || [])];
  if(coastTraits.some(t=>traits.includes(t))) environment.push('coastal');
  if(terrainEnvironments[links.terrain?.type])environment.push(terrainEnvironments[links.terrain.type]);
  if(links.water?.type==='river' || links.water?.type==='canal')environment.push('river');
  if(links.water?.type==='lake')environment.push('lake');
  if(['sea','bay','strait','channel'].includes(links.water?.type))environment.push('coastal');
  const localResources=[...(config.settlement?.resources ?? profile.resources),...(terrainResources[links.terrain?.type] || [])];
  // Environment describes access. It does not assert the presence of a mine or farm.
  const sectors=config.settlement?.industries || profile.industries;
  return {type:place.type || place.category,category:place.category,settlementType:type,scale:profile.scale,
    race:demographics.race || 'human',culture:demographics.culture || 'ancestral',wealth:demographics.wealth || 'modest',
    traits,environment:unique(environment),resources:unique(localResources),industries:unique([...sectors,...traits.map(t=>traitSectors[t]).filter(Boolean)]),
    water:Boolean(links.water),terrain:Boolean(links.terrain),street:Boolean(links.street),
    waterType:links.water?.type || '',terrainType:links.terrain?.type || '',
    navigable:waterKinds.has(links.water?.type) || type==='port' || environment.some(e=>['coastal','river','lake'].includes(e)),
    profile};
}
export function scoreTrade(trade,context) {
  // Maritime specialists need a real water reference or an explicit waterside setting.
  if(trade.industry==='maritime' && !context.navigable)return 0;
  const specialist=['arcane','learning','glass','arts','records'].includes(trade.industry);
  let weight=specialist && context.scale===1 ? 1 : 4;
  if(context.industries.includes(trade.industry))weight*=8;
  if(['jeweler','gemcutter','silversmith','perfumer','illuminator','enchanter','clockmaker','mirror_maker'].includes(trade.id))weight*=context.wealth==='wealthy' ? 3 : context.wealth==='modest' ? 0.5 : 1;
  const resources=industries[trade.industry].resources;
  weight*=1+context.resources.filter(r=>resources.includes(r)).length*2;
  if(context.environment.includes('woodland') && ['wood','medicine'].includes(trade.industry))weight*=3;
  if(context.environment.includes('farmland') && ['agriculture','food','leather'].includes(trade.industry))weight*=3;
  if(context.environment.some(e=>['hills','mountain','underground'].includes(e)) && ['stone','metal'].includes(trade.industry))weight*=3;
  if(context.environment.includes('arid') && ['civic','transport'].includes(trade.industry))weight*=3;
  if(context.environment.includes('wetland') && ['basketmaker','herbalist','netmaker'].includes(trade.id))weight*=3;
  return weight;
}
export function tradeChoices(context,category) {
  return Object.values(tradeCatalog).filter(t=>!category || t.category===category).map(t=>({value:t.id,weight:scoreTrade(t,context)})).filter(t=>t.weight>0).sort((a,b)=>a.value<b.value ? -1 : a.value>b.value ? 1 : 0);
}
export function hasAuthoredTrade(map,place,config) {
  const kind=place.type || place.category,custom=map.generator.catalog?.types?.[kind];
  if(!custom)return false;
  const base=((config.version ?? map.generator.version)===2 ? defaultsV2 : {...defaultsV1,...economyTypes})[kind];
  return ['roles','services'].some(key=>custom[key]!==base?.[key] && JSON.stringify(custom[key])!==JSON.stringify(base?.[key]));
}
export function chooseTrade(map,place,config,context) {
  const kind=place.type || place.category;
  if(hasAuthoredTrade(map,place,config) || place.category==='home' && (config.demographics.population===0 || Object.hasOwn(place.overrides || {},'person')))return null;
  if(Object.hasOwn(tradeCatalog,kind))return tradeCatalog[kind];
  if(config.trade && Object.hasOwn(tradeCatalog,config.trade))return tradeCatalog[config.trade];
  // Custom authored types retain their supplied role, service and stock semantics.
  if(!['home','shop','workshop','guild'].includes(kind))return null;
  const choices=tradeChoices(context,['shop','workshop'].includes(kind) ? kind : undefined);
  const rng=streams(['economy',map.generationId ?? map.id,map.generator.seed,place.id,config.seed ?? '',config.revision ?? 0]);
  return tradeCatalog[choose(choices,rng('trade',[context.settlementType,context.environment,context.resources,context.industries]))];
}
export function materialIsLocal(material,context) {
  const aliases={'iron bars':'iron','copper ingots':'copper','copper sheets':'copper','tanned hides':'hides','pelts':'hides','flour':'grain','fleece':'wool','yarn':'wool','linen thread':'flax','hemp fiber':'hemp','seasoned timber':'timber','timber handles':'timber','carving blanks':'timber','tonewood':'timber','turning blanks':'timber','wand blanks':'timber','stone blocks':'stone','slate':'stone','limestone':'stone','glass panes':'sand','optical blanks':'quartz','cloth':'cloth','vegetables':'farmland','seed stock':'farmland','tea leaves':'herbs'};
  return context.resources.includes(aliases[material] || material);
}
