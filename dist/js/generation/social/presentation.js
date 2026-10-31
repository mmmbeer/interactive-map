import { chooseTrade, economicContext } from '../economy-context.js';
import { choose, streams, integer } from '../helpers-v2.js';
import { render } from '../random.js';
import { sourceDraw, scenarios } from './sources.js';
import { householdTypes } from './household-types.js';
import { roots } from '../wordbanks-v2.js';
import { adult } from './helpers.js';
const mapForGraph=new WeakMap();
export function labelsFor(map,graph,resolve) {
  mapForGraph.set(graph,map);
  return id=>{
    if(!graph.labelCache.has(id)) {
      const p=graph.facts.get(id)?.place || map.locations.find(p=>p.id===id);
      const resolved=resolve(map,p);
      graph.labelCache.set(id,{name:resolved.name,address:resolved.address || '',district:resolved.district});
    }
    return graph.labelCache.get(id);
  };
}
function professionFor(map,graph,p) {
  if(p.workplaceId)return graph.facts.get(p.workplaceId).economy().trade;
  const home=graph.facts.get(p.homeId);if(!home || !adult(p.demographics.age))return null;
  if(p.slot===0)return home.economy().trade;
  const virtual={...home.place,id:p.id},context=economicContext(map,virtual,home.config,p.demographics);
  return chooseTrade(map,virtual,home.config,context);
}
export function contextForPerson(map,graph,p,extra={}) {
  const origin=graph.facts.get(p.homeId || p.workplaceId),context=contextForFact(map,origin,extra,p.demographics),trade=professionFor(map,graph,p);
  context.trade=trade?.id || '';context.industry=trade?.industry || '';
  return context;
}
export function sharedHabit(map,graph,p) {
  if(p.habit)return p.habit;
  const origin=graph.facts.get(p.homeId || p.workplaceId),context=contextForPerson(map,graph,p,{householdStyle:graph.homes.get(p.homeId)?.style || ''});
  const roll=streams(['resident-habit-v1',map.generationId ?? map.id,map.generator.seed,p.id,origin.config.seed ?? '',origin.config.revision ?? 0]);
  const raw=sourceDraw(map,'residentHabits',context,{},roll('habit'));
  p.habit=raw.replace(/^(keeps|collects|asks|copies|practices|saves|compares|shares|draws)\b/,v=>({keeps:'keeping',collects:'collecting',asks:'asking',copies:'copying',practices:'practicing',saves:'saving',compares:'comparing',shares:'sharing',draws:'drawing'}[v]));
  return p.habit;
}
export function personView(graph,p,label) {
  const origin=graph.facts.get(p.workplaceId || p.homeId),d=p.identity.demographics;
  const occupation=p.workplaceId ? graph.facts.get(p.workplaceId).economy().trade?.role || graph.facts.get(p.workplaceId).catalog().types[graph.facts.get(p.workplaceId).place.type || graph.facts.get(p.workplaceId).place.category].roles[0] : adult(d.age) ? professionFor(mapForGraph.get(graph),graph,p)?.role || 'householder' : 'dependent';
  return {id:p.id,name:p.identity.opaque ? `the ${p.workplaceId?'keeper':'resident'} of ${label(origin.id).name}` : p.identity.fullName,
    race:d.race,culture:d.culture,gender:d.gender,age:d.age,role:p.role,occupation,
    homeId:p.homeId,workplaceId:p.workplaceId,home:p.homeId?label(p.homeId).name:null,workplace:p.workplaceId?label(p.workplaceId).name:null,
    profile:p.identity.profile || ''};
}
export function contextForFact(map,fact,extra={},personDemographics) {
  const d={...fact.demographics()};
  if(personDemographics)for(const key of ['race','culture','gender','age'])d[key]=personDemographics[key];
  const context=economicContext(map,fact.place,fact.config,d);
  context.industry=fact.economy().trade?.industry || '';context.trade=fact.economy().trade?.id || '';
  return {...context,...extra};
}
export function renderStory(map,graph,link,label) {
  if(graph.storyCache.has(link.id))return graph.storyCache.get(link.id);
  const a=graph.facts.get(link.from),b=graph.facts.get(link.to),supplier=personView(graph,graph.people.get(link.supplierId),label),buyer=personView(graph,graph.people.get(link.buyerId),label);
  const roll=streams(['shared-story-v1',map.generationId ?? map.id,map.generator.seed,link.id,a.config.seed ?? '',a.config.revision ?? 0,b.config.seed ?? '',b.config.revision ?? 0]);
  const from=label(a.id),to=label(b.id),context=contextForFact(map,a,{scenario:link.scenario},graph.people.get(link.supplierId).identity.demographics);
  const animalType=choose(context.environment.includes('underground') || context.settlementType==='undercity' ? ['gecko','ferret','raven','beetle','cave lizard','white mouse','moth','cricket','toad','tortoise'] : ['cat','dog','songbird','rabbit','ferret','raven','dove','tortoise','goat','white mouse'],roll('animal'));
  const namePool=a.catalog().people[a.catalog().cultures[supplier.culture]?.namePool || supplier.race];
  const tokens={supplier:supplier.name,buyer:buyer.name,fromPlace:from.name,toPlace:to.name,fromAddress:from.address,toAddress:to.address,fromDistrict:from.district,toDistrict:to.district,
    requester:supplier.name,product:link.product,productName:link.product.replace(/^(?:a|an|the) /i,''),item:/^(?:a|an|the) /i.test(link.product)?link.product:`the ${link.product}`,
    amount:String(integer(4,a.identity().demographics.wealth==='wealthy'?80:30,roll('amount'))),settlementType:context.profile.label,
    animalType,animalName:choose(namePool?.nonbinary || roots,roll('animal-name')),route:a.place.context?.street ? label(a.place.context.street).name : from.address};
  const fact=sourceDraw(map,`story_${link.scenario}`,context,tokens,roll('fact'));
  const goal=sourceDraw(map,`goal_${link.scenario}`,context,tokens,roll('goal'));
  const result={...link,label:scenarios[link.scenario].label,state:scenarios[link.scenario].state,requesterId:supplier.id,
    supplier,buyer,amount:Number(tokens.amount),animal:{name:tokens.animalName,type:animalType},fromPlace:from.name,toPlace:to.name,
    fact,goal,request:sourceDraw(map,'request',context,{...tokens,fact,goal},roll('request')),tokens,context};
  graph.storyCache.set(link.id,result);return result;
}
export function storyView(map,event,place,label) {
  const tokens={...event.tokens,fact:event.fact,goal:event.goal,viewPlace:label(place.id).name,district:label(place.id).district};
  const roll=streams(['shared-rumor-v1',map.generationId ?? map.id,map.generator.seed,event.id,place.id]);
  return {id:event.id,label:event.label,scenario:event.scenario,state:event.state,from:event.from,to:event.to,supplierId:event.supplierId,buyerId:event.buyerId,requesterId:event.requesterId,
    product:event.product,amount:event.amount,animal:event.scenario==='pet'?event.animal:null,fact:event.fact,goal:event.goal,request:event.request,
    rumor:sourceDraw(map,'rumor',event.context,tokens,roll('voice'))};
}
export function householdText(map,graph,home,views,label) {
  if(home.count===0)return 'No permanent residents are recorded at this address.';
  const roll=streams(['household-prose-v1',map.generationId ?? map.id,map.generator.seed,home.homeId,home.fact.config.seed ?? '',home.fact.config.revision ?? 0]);
  const context=contextForPerson(map,graph,graph.primaryFor(home.homeId),{householdStyle:home.style});
  const names=views.map(p=>p.name).join(', '),tokens={headName:views[0].name,memberNames:names,householdCount:String(home.count),homePlace:label(home.homeId).name,homeDistrict:label(home.homeId).district,settlementType:context.profile.label};
  tokens.domesticTask=sourceDraw(map,'domesticTasks',context,tokens,roll('task'));
  const prose=sourceDraw(map,`household_${home.style}`,context,tokens,roll('structure'));
  const roster=views.map(p=>`${p.name} (${p.role}, ${p.age.replaceAll('_',' ')} ${p.race.replaceAll('_',' ')}${p.workplace?`; ${p.occupation} at ${p.workplace}`:''})`).join('; ');
  return `${home.count===1?'One resident':`${home.count} residents`} at ${label(home.homeId).name}. ${prose} Residents: ${roster}.${home.count>views.length?` ${home.count-views.length} additional residents are counted but not individually listed.`:''}`;
}
