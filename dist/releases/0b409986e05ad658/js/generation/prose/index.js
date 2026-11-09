import { proseEnabled } from './settings.js';
import { siteProfileFor } from './place-profiles.js';
import { geographyProse } from './geography.js';
import { workLeads } from './commerce.js';
import { streams, choose, article } from '../helpers-v2.js';
import { render } from '../random.js';
const capital=value=>value?value[0].toUpperCase()+value.slice(1):value;
const services={tavern:'Meals, drinks and overnight lodging',teahouse:'Tea and light refreshments',cookshop:'Prepared meals and packed lunches',boarding_house:'Longer stays and shared meals',temple:'Worship, remembrance and quiet visits',harbor:'Passage enquiries, moorings and cargo handling',landmark:'Visitor information and site care',graveyard:'Burial and memorial enquiries',cemetery:'Burial and memorial enquiries',necropolis:'Burial and memorial enquiries',tomb:'Memorial visits and tomb care',crypt:'Memorial visits and crypt care',mausoleum:'Memorial visits and mausoleum care',grave:'Memorial care'};
export function proseDefaults(map,place,{tokens,config,type,economy,social}) {
  if(!proseEnabled(map))return {};
  const stream=streams(['prose-v1',map.generationId ?? map.id,map.generator.seed,place.id,config.seed ?? '',config.revision ?? 0]);
  const input=[place.type || place.category,place.category,tokens.race,tokens.culture,tokens.wealth,config.settlement];
  const draw=(key,values,valuesForTokens=tokens)=>render(choose(values,stream(key,input)),valuesForTokens);
  if(['street','water','terrain'].includes(place.category))return geographyProse(place,tokens,draw);
  const kind=place.type || place.category,profile=siteProfileFor(place,tokens.population),custom=map.generator.catalog?.types?.[kind];
  const role=social?.community?.residents?.[0]?.occupation || economy?.trade?.role || (['tavern','temple','guild','harbor','landmark'].includes(place.category)?type.roles[0]:tokens.role);
  const subject=tokens.subject || 'They',verb=subject==='They'?'are':'is',version=place.generation?.version ?? map.generator.version;
  const habit=version===1?`${subject} ${tokens.habit}.`:`${subject} ${verb} known for ${tokens.habit}.`;
  const vacant=place.category==='home' && tokens.population===0;
  const person=vacant?'':`${tokens.fullName} is ${article(role)} ${role}. ${habit}`;
  const opening=`${tokens.displayName} is ${article(tokens.label)} ${tokens.label} in ${tokens.district}.`;
  const location=place.context?.street?` It stands on ${tokens.street}.`:place.context?.water?` It stands beside ${tokens.water}.`:place.context?.terrain?` It stands near ${tokens.terrain}.`:'';
  const specialized=profile && (!custom || ['home','harbor'].includes(place.category));
  const description=specialized?`${opening} ${draw('site',profile.description)}${location}`:custom?`${opening}${location}`:`${opening} ${tokens.detail} ${tokens.history}${location}`;
  const workflow=economy?.workflow;
  const opaque=Object.hasOwn(place.overrides || {},'person') && !config.social?.personName;
  const leadTokens=opaque?{...tokens,fullName:'the keeper'}:tokens;
  const rumor=specialized?draw('site-lead',profile.rumor):workflow?draw('work-lead',workLeads[workflow],leadTokens):'';
  const service=place.category==='home'?'':custom?tokens.service:kind==='guild' || place.category==='guild'?`Trade introductions and contracts${tokens.trade?` for ${tokens.trade} work`:''}`:services[kind] || services[place.category] || capital(tokens.service);
  const result={description,person,services:service};
  const authoredTask=['task','complication'].some(key=>config.tables[key] || map.generator.catalog?.tables?.[key] || custom?.tables?.[key]);
  if(rumor && !authoredTask)result.rumor=opaque?capital(rumor):rumor;
  return result;
}
export function proseSectionLabel(map,place,field,label,economy) {
  if(!proseEnabled(map) || map.generator.catalog?.sections?.[field])return label;
  if(field==='meals' && place.type==='teahouse')return 'Tea and refreshments';
  if(field==='commissions' && economy?.workflow==='service')return 'Current bookings';
  if(field==='commissions' && economy?.workflow==='documents')return 'Current requests';
  if(field==='stock' && ['service','documents'].includes(economy?.workflow))return 'Services and supplies';
  if(field==='craftTradition' && economy?.workflow!=='craft')return 'Trade practice';
  if(field==='portActivity')return 'Cargo handling';
  if(field==='routeNotes')return 'Along the route';
  if(field==='waterNotes')return 'By the water';
  if(field==='terrainNotes')return 'Around the landscape';
  if(field==='landmarkNotes')return place.type==='grave'?'At the memorial':'Visitors and care';
  return label;
}
