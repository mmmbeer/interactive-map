import { economyTokens } from '../economy-catalog.js';
import { socialGraph } from './index.js';
import { identityTokens } from './identity.js';
import { sharedHabit, labelsFor, personView, renderStory, storyView, householdText, contextForFact } from './presentation.js';
import { socialEnabled, socialTokens } from './sections.js';
import { sourceDraw } from './sources.js';
import { streams, article } from '../helpers-v2.js';
import { adult } from './helpers.js';
export function prepareSharedIdentity(map,place,tokens,demographics) {
  Object.assign(tokens,Object.fromEntries([...socialTokens,...economyTokens].map(k=>[k,''])));
  if(!socialEnabled(map) || ['street','water','terrain','landmark'].includes(place.category))return null;
  const graph=socialGraph(map),person=graph.primaryFor(place.id),home=graph.homes.get(place.id);
  if(!person && home)tokens.livelihoodNote='No resident livelihood is recorded for this unoccupied home.';
  if(!person)return home ? {graph,home,person:null,config:null,skipEconomy:true} : null;
  if(!person.identity.opaque) {
    const values=identityTokens(person.identity);
    // Wealth and population describe this site's local conditions. Identity dimensions travel.
    for(const key of ['race','gender','age','culture'])demographics[key]=values[key];
    for(const key of ['race','raceLabel','gender','age','ageLabel','culture','first','surname','partnerSurname','fullName','firstPossessive','surnamePossessive','fullNamePossessive','pronoun','subject'])tokens[key]=values[key];
  }
  if(!map.generator.catalog?.tables?.habit && !graph.facts.get(place.id).config.tables.habit && !map.generator.catalog?.types?.[place.type || place.category]?.tables?.habit) {
    const habit=sharedHabit(map,graph,person),version=place.generation?.version ?? map.generator.version;
    tokens.habit=version===1 ? `${person.demographics.gender==='nonbinary'?'are':'is'} known for ${habit}` : habit;
  }
  if(home){demographics.population=home.count;tokens.population=home.count;}
  const work=person.workplaceId ? graph.facts.get(person.workplaceId) : null,trade=work?.economy().trade;
  const config=home && trade ? {...home.fact.config,trade:trade.id} : null;
  const skipEconomy=home && (!adult(person.identity.demographics.age) || work && !trade);
  if(skipEconomy)tokens.role=work ? work.catalog().types[work.place.type || work.place.category].roles[0] : 'dependent';
  return {graph,home,person,config,skipEconomy};
}
export function applySocialContent(map,place,{tokens,config,shared,resolve}) {
  if(!shared)return null;
  const graph=shared.graph,label=labelsFor(map,graph,resolve),home=shared.home;
  const people=home ? graph.membersFor(place.id) : shared.person ? [shared.person] : [];
  const views=people.map(p=>personView(graph,p,label));
  const events=(graph.atSite.get(place.id) || []).map(id=>storyView(map,renderStory(map,graph,graph.links.get(id),label),place,label));
  const custom=field=>config.tables[field] || map.generator.catalog?.tables?.[field] || map.generator.catalog?.types?.[place.type || place.category]?.tables?.[field];
  const on=field=>config.fields.includes(field);
  const context=contextForFact(map,graph.facts.get(place.id),{householdStyle:home?.style || ''},shared.person?.identity.demographics);
  const roll=streams(['resident-prose-v1',map.generationId ?? map.id,map.generator.seed,place.id,config.seed ?? '',config.revision ?? 0]);
  const roster=views.map(p=>{
    const work=p.workplace ? ` works as ${article(p.occupation)} ${p.occupation} at ${p.workplace}` : adult(p.age) ? ` is ${article(p.occupation)} ${p.occupation}` : ' is a dependent';
    const residence=p.home ? ` and lives at ${p.home}` : '';
    const subject=p.gender==='female'?'She':p.gender==='male'?'He':'They';
    const habit=p.profile || `${subject} ${subject==='They'?'are':'is'} known for ${sharedHabit(map,graph,people.find(person=>person.id===p.id))}.`;
    return `${p.name}${work}${residence}. ${habit}`;
  }).join(' ');
  tokens.residentNote=on('residents') ? roster : '';
  tokens.connectionNote=on('connections') ? events.map(e=>e.fact).join(' ') : '';
  tokens.requestNote=on('requests') ? events.map(e=>e.request).join(' ') : '';
  if(home && on('household') && !custom('household') && !map.generator.catalog?.detailSources?.household)tokens.household=householdText(map,graph,home,views,label);
  if(home && shared.person?.workplaceId && on('livelihood') && !custom('livelihood'))tokens.livelihoodNote=`${views[0].name} works as ${article(views[0].occupation)} ${views[0].occupation} at ${views[0].workplace}.`;
  if(home && shared.person && !adult(shared.person.identity.demographics.age) && on('livelihood'))tokens.livelihoodNote='The primary resident is a dependent. No adult occupation is assigned.';
  const related=new Map();
  const add=(id,kind)=>{if(id && id!==place.id)related.set(id,{id,name:label(id).name,kind});};
  for(const p of views){add(p.homeId,'residence');add(p.workplaceId,'workplace');}
  for(const e of events){add(e.from,'shared story');add(e.to,'shared story');}
  return {rumor:!custom('rumor') && events.length ? events[0].rumor : null,
    profile:shared.person?.identity.profile || null,
    community:{household:home ? {id:home.id,homeId:home.homeId,count:home.count,style:home.style,unlisted:Math.max(0,home.count-views.length)} : null,residents:views,stories:events,related:[...related.values()]}};
}
