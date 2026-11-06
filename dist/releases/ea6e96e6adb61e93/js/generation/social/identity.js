import { random, pick, weighted } from '../random.js';
import { choose, distribution, streams } from '../helpers-v2.js';
import { dimensions } from '../config.js';
const label=s=>s.replaceAll('_',' ');
// Reproduce the released primary identity exactly, without resolving names, prose,
// geographic references or any other place. Social passes never call each other.
export function primaryDemographics(map,place,config) {
  const version=place.generation?.version ?? map.generator.version;
  const seed=[map.generationId ?? map.id,map.generator.seed,place.id,config.seed ?? '',config.revision ?? 0];
  const s=version===1 ? (field,input='')=>random([[1,...seed],field,input]) : streams(seed);
  const dist=version===1 ? weighted : distribution,d={};
  for(const [one,many] of Object.entries(dimensions))d[one]=config.demographics[one] ?? dist(config.demographics[many],s(one,config.demographics[many]));
  if(config.demographics.population!==undefined)d.population=config.demographics.population;
  return d;
}
export function memberDemographics(map,home,config,slot,stage,primary) {
  if(slot===0)return primary;
  const roll=streams(['household-person-v1',map.generationId ?? map.id,map.generator.seed,home.id,config.seed ?? '',config.revision ?? 0,slot]);
  const d={...primary};delete d.population;
  d.gender=choose(['female','male','nonbinary'],roll('gender'));d.age=stage;
  d.race=config.demographics.race ?? distribution(config.demographics.races,roll('race'));
  d.culture=config.demographics.culture ?? distribution(config.demographics.cultures,roll('culture'));
  return d;
}
export function baseIdentity(map,place,config,catalog,demographics) {
  const version=place.generation?.version ?? map.generator.version;
  const seed=[map.generationId ?? map.id,map.generator.seed,place.id,config.seed ?? '',config.revision ?? 0];
  const s=version===1 ? (field,input='')=>random([[1,...seed],field,input]) : streams(seed);
  const select=version===1 ? pick : choose,d=demographics || primaryDemographics(map,place,config);
  const identity=version===1 ? [d.race,d.gender,d.culture] : [d.race,d.culture,d.gender];
  const pool=catalog.people[catalog.cultures[d.culture]?.namePool || d.race];
  const first=select(pool[d.gender],s('first',identity)),surname=select(pool.surnames,s('surname',identity));
  const alternatives=pool.surnames.filter(n=>n!==surname),partnerSurname=select(alternatives.length ? alternatives : pool.surnames,s(version===1 ? 'partner-surname' : 'partner',identity));
  const district=(map.districts || []).find(d=>(typeof d==='string'?d:d.id)===place.district);
  const districtName=typeof district==='string' ? district : district?.name || place.district;
  const fullName=config.social?.personName || (version===1 ? pick([{value:`${first} ${surname}`,weight:8},{value:`${first} ${surname}-${partnerSurname}`,weight:1},{value:`${first} of ${districtName}`,weight:1}],s('person-name',identity)) : `${first} ${surname}`);
  return {first:config.social?.personName || first,surname:config.social?.personName || surname,partnerSurname,fullName,demographics:d,opaque:Object.hasOwn(place.overrides || {},'person') && !config.social?.personName,profile:place.overrides?.person || ''};
}
export function memberIdentity(map,home,config,catalog,slot,plan,primary,previous=[]) {
  if(slot===0)return primary;
  const roll=streams(['household-person-v1',map.generationId ?? map.id,map.generator.seed,home.id,config.seed ?? '',config.revision ?? 0,slot]);
  const d=memberDemographics(map,home,config,slot,plan.stage,primary.demographics);
  const pool=catalog.people[catalog.cultures[d.culture]?.namePool || d.race];
  const surname=!config.social?.personName && plan.kin && d.race===primary.demographics.race && d.culture===primary.demographics.culture ? primary.surname : choose(pool.surnames,roll('surname'));
  const available=pool[d.gender].filter(name=>!previous.some(p=>p.fullName===`${name} ${surname}`));
  const first=choose(available.length?available:pool[d.gender],roll('first'));
  return {first,surname,partnerSurname:primary.partnerSurname,fullName:`${first} ${surname}`,demographics:d,opaque:false,profile:''};
}
export function identityTokens(identity) {
  const d=identity.demographics,possessive=s=>/s$/i.test(s)?`${s}’`:`${s}’s`;
  return {...d,raceLabel:label(d.race),ageLabel:label(d.age),first:identity.first,surname:identity.surname,partnerSurname:identity.partnerSurname,fullName:identity.fullName,
    firstPossessive:possessive(identity.first),surnamePossessive:possessive(identity.surname),fullNamePossessive:possessive(identity.fullName),
    pronoun:d.gender==='female'?'she':d.gender==='male'?'he':'they',subject:d.gender==='female'?'She':d.gender==='male'?'He':'They'};
}
