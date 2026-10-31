import { configFor } from '../generation/config.js';
import { economicContext } from '../generation/economy-context.js';
import { canonical, random, weighted } from '../generation/random.js';
import { boardRecipe, integrationSettings } from './config.js';

export function contentSeed(value) {
  const rng=random(['atlas-connected-content-v1',value]);
  return 'atlas-'+Array.from({length:4},()=>Math.floor(rng()*4294967296).toString(16).padStart(8,'0')).join('');
}
export const shortText=(value,max=120)=>String(value ?? '').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
const apiRace=value=>value?.replaceAll('_','-');
const apiAge=value=>({young_adult:'young adult',middle_aged:'middle-aged',elder:'old'}[value] || value?.replaceAll('_',' '));
function choice(dimension,config,seed) {
  return config.demographics[dimension] ?? (config.demographics[dimension+'s'] ? weighted(config.demographics[dimension+'s'],random([seed,dimension])) : undefined);
}
export function contentContext(map,place) {
  const source=map.locations.find(p=>p.id===place.id) || place;
  const {config}=configFor(map,source);
  return {source,config,settings:integrationSettings(source),
    seed:[map.generationId ?? map.id,map.generator?.seed ?? '',source.id,config.seed ?? '',config.revision ?? 0],
    economy:economicContext(map,source,config,place.demographics)};
}
export function questRequest(map,place,options,view='player') {
  const ctx=contentContext(map,place),s=ctx.settings.quests;
  const locationId=s.locationId || boardRecipe(ctx.source,ctx.economy);
  if(!options.locations?.some(p=>p.id===locationId))throw new Error(`Help Board does not support the “${locationId}” recipe. Edit this location’s connected content settings.`);
  if(!options.tones?.includes(s.tone))throw new Error(`Help Board does not support the “${s.tone}” tone.`);
  return {locationId,level:s.level,count:s.count,tone:s.tone,view,seed:contentSeed(['quests',ctx.seed]),
    context:{mapId:shortText(map.generationId ?? map.id),placeId:shortText(place.id),placeName:shortText(place.name),
      settlementName:shortText(map.name),districtName:shortText(place.district)}};
}
export function sorrowRequests(map,place,options) {
  const ctx=contentContext(map,place),s=ctx.settings.sorrow;
  if(s.npc?.name && s.count!==1)throw new Error('A named NPC needs exactly one grave story.');
  return Array.from({length:s.count},(_,i)=>{
    // Each grave has its own stable slot. Increasing the count retains earlier graves.
    const seed=contentSeed(['sorrow',ctx.seed,i+1]);
    const npc={race:apiRace(choice('race',ctx.config,seed)),...s.npc};
    npc.race=apiRace(npc.race);
    if(!npc.race)delete npc.race;
    // Site demographics describe the burial population. Never reuse its living keeper's identity.
    const age=s.npc?.age ?? choice('age',ctx.config,seed),sex=s.npc?.sex ?? choice('gender',ctx.config,seed);
    if(age!==undefined)npc.age=typeof age==='number'?age:apiAge(age);
    if(sex!==undefined)npc.sex=sex;
    for(const [key,bank] of Object.entries({race:'races',sex:'sexes',age:'ages',occupation:'occupations'})) {
      if(npc[key]!==undefined && !(key==='age' && typeof npc.age==='number') && !options[bank]?.includes(npc[key])) {
        throw new Error(`NPC Sorrow does not support ${key} “${npc[key]}”. Set a supported value in this location’s connected content settings.`);
      }
    }
    return {seed,count:1,npc,location:'generic-fantasy',locationName:shortText(map.name)};
  });
}
export const requestIdentity=(kind,input)=>canonical([kind,input]);
