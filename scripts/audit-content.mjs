import { pathToFileURL } from 'node:url';
import { catalogFor } from '../public/js/generation/config.js';
import { materializeMap } from '../public/js/generation/locations.js';
import { settlementTypes } from '../public/js/generation/economy-settlements.js';
import { ancestries } from '../public/js/generation/settlement-pools-v1.js';

export function auditMap({ancestry='human',settlement='town',seed='audit',social=false,polished=true,wealth='comfortable',gender='nonbinary'}={}) {
  const map={schemaVersion:2,id:'content-audit',name:'Audit Town',subtitle:'Audit fixture',description:'Generated-content audit fixture',theme:'Fantasy',region:'Audit Region',image:'map.webp',thumbnail:'thumb.webp',width:1000,height:1000,
    generator:{version:2,detailsVersion:2,...(polished?{proseVersion:1}:{}),...(social?{socialVersion:1}:{}),seed,
      defaults:{demographics:{race:ancestry,gender,age:'adult',wealth},settlement:{type:settlement}}},
    districts:[{id:'ward',name:'Audit Ward'}],locations:[]};
  const types=catalogFor(map).types;
  for(const [kind,type] of Object.entries(types))map.locations.push({id:`type-${kind.replaceAll('_','-')}`,type:kind,category:type.category,district:'ward',x:100,y:100});
  const road=map.locations.find(p=>p.type==='road');road.overrides={name:'North Crossing'};
  for(const place of map.locations)if(!['street','water','terrain'].includes(place.category))place.context={street:road.id};
  if(social) {
    const makeHome=(id,population,age='adult')=>({id,type:'home',category:'home',district:'ward',x:150,y:150,generation:{demographics:{population,age}}});
    map.locations.push(...Array.from({length:35},(_,i)=>makeHome(`household-${i}`,4)),makeHome('vacant-home',0),makeHome('dependent-home',1,'child'),makeHome('single-home',1));
  }
  return map;
}
export function contentIssues(place) {
  const issues=[],texts={description:place.description,person:place.person,services:place.services,rumor:place.rumor,...Object.fromEntries(Object.entries(place.extra).map(([key,value])=>[key,value.text]))};
  const flag=(rule,field,text)=>issues.push({type:place.type || place.category,id:place.id,rule,field,text:text.slice(0,360)});
  const names=[place.name,...(place.community?.related || []).map(p=>p.name)].sort((a,b)=>b.length-a.length);
  for(const [field,text] of Object.entries(texts)) {
    if(/\bundefined\b|\bnull\b|\{[a-zA-Z]\w*\}|\.\./.test(text))flag('unresolved-text',field,text);
    if(/\b(?:a|an|the) (?:a|an|the)\b|’s (?:a|an|the)\b/i.test(text))flag('broken-article',field,text);
    if(/\bhelp to help\b|\bfind someone to find\b/i.test(text))flag('nested-action',field,text);
    if(/mapped geography|two mapped locations|this town setting|household register|without changing the original account/i.test(text))flag('meta-boilerplate',field,text);
    const body=names.reduce((value,name)=>value.replaceAll(name,'[place]'),text);
    if(['rumor','commissions','contracts'].includes(field) && /(?:weigh|packing for|surface finish of|sample of|containers for|two batches of|maker’s mark on)[^.!?]*\b(?:rooms|bookings|lessons|appointments|reservations)\b/i.test(body))flag('physical-booking',field,text);
  }
  if(place.category==='home' && place.services)flag('residence-advertising','services',place.services);
  if(['teahouse','cookshop'].includes(place.type) && place.extra.lodgings.text)flag('unexpected-lodging','lodgings',place.extra.lodgings.text);
  if(place.extra.meals.text.split(/(?<=[.!?])\s+/).some(v=>/\bwith\b[^.!?]*\bwith\b/i.test(v)))flag('repeated-menu-join','meals',place.extra.meals.text);
  if(['graveyard','cemetery','necropolis','tomb','crypt','mausoleum','grave'].includes(place.type) && /counter|kitchen|cellar|lease|guest room|workshop|shopkeeper/i.test(place.description))flag('burial-shop-prose','description',place.description);
  if(place.category==='harbor' && place.extra.portActivity.text.split(/(?<=[.!?])\s+/).length>1 && /(?:ledger|receipt|fee|tally|witness|order)[^.!?]*\./i.test(place.extra.portActivity.text) && /rigging|rope|platform/i.test(place.extra.portActivity.text))flag('unrelated-cargo-followup','portActivity',place.extra.portActivity.text);
  if(['street','water','terrain'].includes(place.category) && (place.person || place.services))flag('geographic-business','person',place.person+' '+place.services);
  if(place.community?.household?.count===0 && (place.person || place.community.stories.length || place.extra.residents.text))flag('vacant-household','person',place.person);
  return issues;
}
export function runContentAudit({polished=true,settlements=Object.keys(settlementTypes),races=Object.keys(ancestries),socialModes=[false,true]}={}) {
  const counts={},examples=new Map();let sites=0,maps=0,total=0;
  for(const social of socialModes)for(const [si,settlement] of settlements.entries())for(const [ri,ancestry] of races.entries()) {
    const map=auditMap({social,polished,settlement,ancestry,seed:`audit-${si}-${ri}`,wealth:['modest','comfortable','wealthy'][(si+ri)%3],gender:['female','male','nonbinary'][(si+ri)%3]});
    maps++;
    for(const p of materializeMap(map).locations) {
      sites++;
      for(const issue of contentIssues(p)) {
        total++;counts[issue.rule]=(counts[issue.rule] || 0)+1;
        if(!examples.has(issue.rule))examples.set(issue.rule,issue);
      }
    }
  }
  return {profile:polished?'proseVersion 1':'legacy',types:Object.keys(catalogFor(auditMap()).types).length,settlements:settlements.length,ancestries:races.length,maps,sites,issues:total,counts,examples:[...examples.values()]};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const result=runContentAudit({polished:!process.argv.includes('--legacy')});
  console.log(JSON.stringify(result,null,2));
  if(result.issues && result.profile!=='legacy')process.exitCode=1;
}
