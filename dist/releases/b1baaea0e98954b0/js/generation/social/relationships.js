import { compatibleProducts } from './goods.js';
import { hash, pairRank, compare, addTo } from './helpers.js';
import { choose, streams } from '../helpers-v2.js';
import { workflowFor } from '../economy-workflows.js';
import { proseEnabled } from '../prose/settings.js';
import { scenariosForProduct } from '../prose/workflows.js';
const needs={
  agriculture:['wood','metal','textiles','leather','records'],food:['maritime','agriculture','wood','metal','glass','stone','records'],
  textiles:['agriculture','wood','metal','records'],leather:['agriculture','metal','textiles','wood'],wood:['metal','agriculture','records'],
  metal:['wood','stone','leather','transport'],stone:['wood','metal','transport'],glass:['wood','stone','metal'],
  maritime:['maritime','wood','metal','textiles','glass','food','records'],transport:['wood','leather','metal','food','records'],
  records:['agriculture','leather','wood','arts'],learning:['arcane','records','glass','wood','arts'],arcane:['arcane','glass','stone','metal','medicine','records'],
  medicine:['agriculture','glass','stone','textiles'],hospitality:['maritime','food','agriculture','wood','textiles','medicine','commerce'],
  arts:['wood','stone','metal','textiles','records'],commerce:['arcane','maritime','food','wood','textiles','agriculture','records'],civic:['wood','metal','stone','medicine','records']
};
const specialties={cooper:['brewer','distiller','wine_merchant','tavern','boarding_house','ship_chandler'],ropemaker:['shipwright','boatbuilder','sailmaker','harbor','netmaker'],papermaker:['scribe','stationer','bookbinder','cartographer','notary'],weaver:['tailor','embroiderer','sailmaker','boarding_house'],miller:['bakery','cookshop','tavern'],beekeeper:['chandler','confectioner','apothecary','perfumer'],tanner:['saddler','shoemaker','leatherworker','bookbinder']};
export function buildConnections(map,facts,census) {
  const links=new Map(),atSite=new Map(),degrees=new Map(),seed=hash(JSON.stringify(['social-links-v1',map.generationId ?? map.id,map.generator.seed]));
  const sites=[...facts.values()].filter(f=>f.place.category!=='home');
  const industries=new Map(sites.map(f=>[f.id,f.economy().trade?.industry || ({tavern:'hospitality',guild:'commerce',temple:'civic',harbor:'maritime'})[f.place.category]]));
  const add=(kind,a,b,trade,scenarios,products)=>{
    if(a.id===b.id || (degrees.get(a.id)||0)>=3 || (degrees.get(b.id)||0)>=3)return false;
    const supplier=census.primaryFor(a.id);let buyer=census.primaryFor(b.id);
    if(supplier && buyer?.id===supplier.id && b.place.category==='home')buyer=census.membersFor(b.id).find(p=>p.id!==supplier.id && !['child','infant','adolescent'].includes(p.demographics.age));
    if(!supplier || !buyer || supplier.id===buyer.id)return false;
    const id=`story:${kind}:${a.id}:${b.id}`;
    const roll=streams(['social-event-v1',map.generationId ?? map.id,map.generator.seed,id,a.config.seed ?? '',a.config.revision ?? 0,b.config.seed ?? '',b.config.revision ?? 0]);
    const product=trade ? choose(products || trade.items,roll('product')) : choose(['a family recipe book','a set of measuring weights','a sewing basket','a carved keepsake box','a borrowed handcart','a tool chest','a wool blanket','a packet of copied letters','a set of clay dishes','a folding work stool'],roll('keepsake'));
    const choices=proseEnabled(map) && trade ? scenariosForProduct(trade,product,a.place) : scenarios;
    const scenario=choose(choices,roll('scenario'));
    const link={id,kind,from:a.id,to:b.id,supplierId:supplier.id,buyerId:buyer.id,tradeId:trade?.id || null,product,scenario};
    links.set(id,link);addTo(atSite,a.id,id);addTo(atSite,b.id,id);degrees.set(a.id,(degrees.get(a.id)||0)+1);degrees.set(b.id,(degrees.get(b.id)||0)+1);return true;
  };
  // Pass 3A: an existing household member's workplace can share an actual request.
  for(const h of census.homes.values())for(const workId of h.workplaces) {
    const work=facts.get(workId),trade=work.economy().trade;
    add('residence',work,h.fact,trade,trade && ['service','documents'].includes(workflowFor(trade)) ? ['missing_record','collection','festival'] : ['missing_record','collection','keepsake','festival']);
  }
  // Pass 3B: match a producer to a real compatible buyer, rather than inventing one.
  for(const source of sites) {
    const trade=source.economy().trade;if(!trade || (degrees.get(source.id)||0)>=3)continue;
    const candidates=sites.filter(target=>target.id!==source.id && (degrees.get(target.id)||0)<3 &&
      (target.district===source.district || source.region && target.region===source.region) &&
      (needs[industries.get(target.id)] || []).includes(trade.industry));
    let targetChoice=null,productChoices=null,best=-1;
    for(const target of candidates) {
      let weight=target.district===source.district?8:1;
      if(source.place.context?.street && source.place.context.street===target.place.context?.street)weight*=3;
      if(source.place.context?.water && source.place.context.water===target.place.context?.water)weight*=2;
      if(specialties[trade.id]?.includes(target.place.type || target.place.category))weight*=8;
      const score=pairRank(source.rank,target.rank,seed)*weight;
      if(score>best || score===best && compare(target.id,targetChoice.id)<0){const products=compatibleProducts(trade,target);if(products.length){best=score;targetChoice=target;productChoices=products;}}
    }
    const workflow=workflowFor(trade);
    const scenarios=workflow==='service' ? ['appointment','missing_record','invoice','collection'] : workflow==='documents' ? ['missing_record','copy_dispute','invoice','collection'] : ['delivery','invoice','damaged','replacement','collection','misdirected'];
    if(workflow==='craft')scenarios.push('makers_mark');
    if(trade.industry==='arcane')scenarios.push('whispering_work');
    if(['cartographer','chartmaker'].includes(trade.id) && source.place.context?.street)scenarios.push('map_clue');
    if(['food','agriculture','hospitality'].includes(trade.industry))scenarios.push('festival');
    if(targetChoice)add('trade',source,targetChoice,trade,scenarios,productChoices);
  }
  // Pass 3C: quieter residential stories use real neighboring households.
  const homes=[...census.homes.values()].filter(h=>h.count>0);
  const homesByDistrict=new Map();for(const h of homes)addTo(homesByDistrict,h.fact.district,h);
  for(const h of homes) {
    if((degrees.get(h.homeId)||0)>0)continue;
    let chosen=null,best=-1;
    for(const other of homesByDistrict.get(h.fact.district) || []) {
      if(other===h || (degrees.get(other.homeId)||0)>=3)continue;
      const score=pairRank(h.fact.rank,other.fact.rank,seed);
      if(score>best || score===best && compare(other.homeId,chosen.homeId)<0){best=score;chosen=other;}
    }
    if(chosen)add('neighbors',h.fact,chosen.fact,null,['keepsake','shared_task','missing_record','pet','heirloom','festival']);
  }
  return {links,atSite};
}
