import { choose, integer, streams } from '../helpers-v2.js';
import { householdTypes } from './household-types.js';
import { memberIdentity, memberDemographics } from './identity.js';
import { hash, pairRank, compare, adult, permits, addTo } from './helpers.js';
const workerCategories=new Set(['shop','workshop','tavern','guild','temple','harbor']);
export function buildHouseholds(map,facts) {
  const homes=new Map(),people=new Map(),keepers=new Map(),byDistrict=new Map(),byRegion=new Map(),warnings=[];
  const seed=hash(JSON.stringify([map.generationId ?? map.id,map.generator.seed,'households-v1']));
  for(const f of facts.values())if(f.place.category==='home') {
    const roll=streams(['household-v1',map.generationId ?? map.id,map.generator.seed,f.id,f.config.seed ?? '',f.config.revision ?? 0]);
    const forced=f.config.social?.householdStyle;
    const forcedType=householdTypes[forced];
    const count=f.config.demographics.population ?? (forcedType ? integer(forcedType.min,Math.min(forcedType.max || 6,Math.max(6,forcedType.min)),roll('size')) : choose([{value:'1',weight:2},{value:'2',weight:4},{value:'3',weight:4},{value:'4',weight:3},{value:'5',weight:2},{value:'6',weight:1}],roll('size'))*1);
    const choices=Object.entries(householdTypes).filter(([,t])=>count>=t.min && (!t.max || count<=t.max));
    let style=count===0 ? 'empty' : forced || choose(choices.map(([value])=>({value,weight:value==='shared_lodging' && ['city','metropolis','academy','caravan_stop'].includes(f.config.settlement?.type) ? 4 : 1})),roll('structure'));
    if(count>1 && !adult(f.demographics().age) && !forced)style='guardian_dependents';
    const h={id:`household:${f.id}`,homeId:f.id,fact:f,count,style,members:[],workplaces:[]};
    homes.set(f.id,h);addTo(byDistrict,f.district,h);if(f.region)addTo(byRegion,f.region,h);
  }
  const resident=(h,slot)=>{
    if(h.members[slot])return h.members[slot];
    const t=householdTypes[h.style],primaryDemographics=h.fact.demographics();
    const childPrimary=!adult(primaryDemographics.age);
    let role=t.roles[Math.min(slot,t.roles.length-1)],stage=t.stages[Math.min(slot,t.stages.length-1)];
    if(slot===0)stage=primaryDemographics.age;
    if(childPrimary){role=slot===0?'dependent':slot===1?'guardian':'relative';if(slot>0)stage='adult';}
    let identity;
    const demographics=memberDemographics(map,h.fact.place,h.fact.config,slot,stage,primaryDemographics);
    const p={get identity(){return identity ||= memberIdentity(map,h.fact.place,h.fact.config,h.fact.catalog(),slot,{stage,kin:t.kin},h.fact.identity());},demographics,opaque:slot===0 && Object.hasOwn(h.fact.place.overrides || {},'person') && !h.fact.config.social?.personName,id:`resident:${h.homeId}:${slot}`,homeId:h.homeId,householdId:h.id,slot,role,workplaceId:null};
    h.members[slot]=p;people.set(p.id,p);return p;
  };
  const install=(work,h,primaryOnly=false,explicit=false)=>{
    if(!h || h.count===0)return false;
    // Authored profiles are opaque unless an author supplies a shareable personName.
    if(Object.hasOwn(work.place.overrides || {},'person') && !work.config.social?.personName)return false;
    for(let slot=0;slot<Math.min(h.count,12);slot++) {
      if(primaryOnly && slot!==0)break;
      const p=resident(h,slot);
      if(p.workplaceId || p.role==='relative receiving support' || p.opaque || !adult(p.demographics.age) || !permits(work.config,p.demographics))continue;
      if(work.config.social?.personName) {
        const identity=work.identity();
        if(!permits(h.fact.config,identity.demographics) || slot>0 && p.demographics.age!==identity.demographics.age || slot===0 && h.fact.config.social?.personName && h.fact.config.social.personName!==identity.fullName)continue;
        Object.defineProperty(p,'identity',{enumerable:true,configurable:true,value:identity});p.demographics={...identity.demographics};
      }
      p.workplaceId=work.id;keepers.set(work.id,p);h.workplaces.push(work.id);return true;
    }
    if(explicit)warnings.push(`${work.id}: no compatible adult household slot at ${h.homeId}.`);
    return false;
  };
  const workers=[...facts.values()].filter(f=>workerCategories.has(f.place.category));
  // Explicit references reserve capacity before automatic matching.
  for(const h of homes.values())if(h.fact.config.social?.workplace) {
    const work=facts.get(h.fact.config.social.workplace);
    if(work && !keepers.has(work.id))install(work,h,true,true);
  }
  for(const work of workers)if(work.config.social?.home && !keepers.has(work.id))install(work,homes.get(work.config.social.home),false,true);
  const pinned=new Set([...homes.values()].map(h=>h.fact.config.social?.workplace).filter(Boolean));
  for(const work of workers) {
    if(keepers.has(work.id))continue;
    if(Object.hasOwn(work.place.overrides || {},'person') && !work.config.social?.personName)continue;
    if(work.config.social?.home || pinned.has(work.id))continue;
    const local=byDistrict.get(work.district) || [],regional=byRegion.get(work.region) || [];
    const groups=[local,regional.length ? regional : [...homes.values()]];
    const seen=new Set();
    for(const group of groups) {
      const ranked=group.filter(h=>h.count>0 && !seen.has(h.homeId)).map(h=>({h,score:pairRank(work.rank,h.fact.rank,seed)})).sort((a,b)=>b.score-a.score || compare(a.h.homeId,b.h.homeId));
      let found=false;
      for(const {h} of ranked){seen.add(h.homeId);if(install(work,h)){found=true;break;}}
      if(found)break;
    }
  }
  for(const work of workers) {
    if(!keepers.has(work.id)) {
      const p={id:`keeper:${work.id}`,homeId:null,householdId:null,slot:null,role:'keeper',get identity(){return work.identity();},get demographics(){return work.demographics();},workplaceId:work.id};
      people.set(p.id,p);keepers.set(work.id,p);
    }
  }
  // Complete a household only when it is requested, rather than naming every citizen at startup.
  const membersFor=homeId=>{const h=homes.get(homeId);if(!h)return [];for(let i=0;i<Math.min(h.count,12);i++)resident(h,i);return h.members;};
  const primaryFor=id=>homes.has(id) ? homes.get(id).count ? resident(homes.get(id),0) : null : keepers.get(id) || null;
  return {homes,people,keepers,membersFor,primaryFor,warnings};
}
