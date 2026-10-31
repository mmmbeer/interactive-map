import { householdTypes } from './household-types.js';
import { socialGraph, clearSocialGraph } from './index.js';
import { socialSources, recipeTokens, scenarios } from './sources.js';
import { conditionKeys, matchingSources } from '../detail-helpers-v1.js';
import { contextForFact, contextForPerson } from './presentation.js';
import { render } from '../random.js';
import { adult } from './helpers.js';
const object=v=>v && typeof v==='object' && !Array.isArray(v);
const text=v=>typeof v==='string' && v.trim().length>0;
export function validateSocialSettings(value,check,prefix) {
  check(object(value),`${prefix}: social settings must be an object.`);
  check(Object.keys(value).every(k=>['enabled','home','workplace','householdStyle','personName'].includes(k)),`${prefix}: unknown social setting.`);
  if(value.enabled!==undefined)check(typeof value.enabled==='boolean',`${prefix}: enabled must be boolean.`);
  for(const key of ['home','workplace','personName'])if(value[key]!==undefined)check(text(value[key]),`${prefix}: invalid social ${key}.`);
  if(value.householdStyle!==undefined)check(Object.hasOwn(householdTypes,value.householdStyle),`${prefix}: unknown household style.`);
}
export function validateSocialRecipes(map,check) {
  const custom=map.generator.catalog?.socialRecipes;if(custom===undefined)return;
  check(map.generator.socialVersion===1 && object(custom),'Social recipes require socialVersion 1 and an object.');
  const dummy=Object.fromEntries(recipeTokens.map(k=>[k,'sample']));
  for(const [key,entries] of Object.entries(custom)) {
    check(Object.hasOwn(socialSources,key),`Unknown social recipe ${key}.`);
    check(Array.isArray(entries),`${key}: social recipe must be an array.`);
    const literal=['domesticTasks','residentHabits','residentErrands'].includes(key);
    const allowed=literal ? [] : key.startsWith('household_') ? 'headName memberNames householdCount domesticTask homePlace homeDistrict settlementType'.split(' ') : recipeTokens.filter(k=>!['headName','memberNames','householdCount','domesticTask','homePlace','homeDistrict'].includes(k) && (key==='rumor' || !['viewPlace','district'].includes(k)) && (['rumor','request'].includes(key) || !['fact','goal'].includes(k)));
    const distinct=new Set();
    for(const item of entries) {
      const v=object(item)?item.value:item,w=object(item)?item.weight ?? 1:1;
      check(text(v) && Number.isFinite(w) && w>=0,`${key}: invalid text or weight.`);
      check(!/[{}]/.test(v.replace(/\{[a-zA-Z][a-zA-Z0-9_]*\}/g,'')),`${key}: malformed template.`);
      for(const m of v.matchAll(/\{(\w+)\}/g))check(allowed.includes(m[1]),`${key}: unavailable token ${m[1]}.`);
      render(v,dummy);if(w>0)distinct.add(v);
      if(object(item)) {
        check(Object.keys(item).every(k=>['value','weight','when'].includes(k)),`${key}: unknown recipe property.`);
        if(item.when!==undefined) {
          check(object(item.when),`${key}: invalid conditions.`);
          for(const [k,list] of Object.entries(item.when)) {
            check(conditionKeys.includes(k),`${key}: unknown condition ${k}.`);
            if(k==='households')check(Array.isArray(list) && list.every(v=>Object.hasOwn(householdTypes,v)),`${key}: unknown household condition.`);
            if(k==='situations')check(Array.isArray(list) && list.every(v=>Object.hasOwn(scenarios,v)),`${key}: unknown situation condition.`);
            check(['water','terrain','street'].includes(k)?typeof list==='boolean':Array.isArray(list)&&list.length>0&&list.every(text),`${key}: invalid condition ${k}.`);
          }
        }
      }
    }
    check(distinct.size>=100,`${key}: 100 positive-weight variations are required.`);
  }
}
export function validateHouseholdInputs(place,config,check) {
  const style=config.social?.householdStyle;if(!style)return;
  check(place.category==='home',`${place.id}: a household style requires a home.`);
  const t=householdTypes[style],count=config.demographics.population;
  if(count!==undefined)check(count>=t.min && (!t.max || count<=t.max),`${place.id}: household style is incompatible with population.`);
  const ages=config.demographics.age ? [config.demographics.age] : Object.keys(config.demographics.ages || {}).filter(k=>config.demographics.ages[k]>0);
  if(ages.some(age=>!adult(age)) && style!=='solitary')check(style==='guardian_dependents',`${place.id}: a dependent primary resident requires a guardian household.`);
}
export function validateSocialMap(map,check) {
  if(map.generator?.socialVersion!==1)return;
  clearSocialGraph(map);
  for(const layer of [map.generator.defaults,...(map.regions||[]).map(r=>r.generation),...(map.districts||[]).map(d=>d.generation)])check(!layer?.social?.home && !layer?.social?.workplace && !layer?.social?.personName,'Shared names, residence and workplace references belong on individual locations.');
  const index=new Map(map.locations.map(p=>[p.id,p])),explicit=new Map();
  for(const p of map.locations) {
    const s=p.generation?.social;if(!s)continue;
    if(s.home!==undefined){check(p.category!=='home' && !['street','water','terrain','landmark'].includes(p.category),`${p.id}: only a workplace can select a residence.`);check(index.get(s.home)?.category==='home',`${p.id}: residence must reference an existing home.`);}
    if(s.workplace!==undefined) {
      check(p.category==='home',`${p.id}: only a home can select a primary workplace.`);
      const target=index.get(s.workplace);check(target && ['shop','workshop','tavern','guild','temple','harbor'].includes(target.category),`${p.id}: workplace must reference a working location.`);
      check(!explicit.has(s.workplace),`${p.id}: primary workplace already assigned to another home.`);explicit.set(s.workplace,p.id);
      check(!target.generation?.social?.home || target.generation.social.home===p.id,`${p.id}: conflicting residence references.`);
    }
    if(s.householdStyle!==undefined)check(p.category==='home',`${p.id}: a household style requires a home.`);
  }
  if(!map.generator.catalog?.socialRecipes && explicit.size===0 && !map.locations.some(p=>p.generation?.social?.home))return;
  const g=socialGraph(map);
  for(const h of g.homes.values()) {
    if(h.style==='empty')continue;
    const t=householdTypes[h.style];check(t && h.count>=t.min && (!t.max || h.count<=t.max),`${h.homeId}: household style is incompatible with population.`);
    if(!adult(h.fact.demographics().age) && h.count>1)check(h.style==='guardian_dependents',`${h.homeId}: a dependent primary resident requires a guardian household.`);
  }
  for(const [work,home] of explicit)check(g.keepers.get(work)?.id===`resident:${home}:0`,`${home}: primary resident is incompatible with the specified workplace.`);
  for(const f of g.facts.values())if(f.config.social?.home)check(g.keepers.get(f.id)?.homeId===f.config.social.home,`${f.id}: residence has no compatible adult slot or has an opaque authored profile.`);
  check(g.warnings.length===0,g.warnings[0]);
  const custom=map.generator.catalog?.socialRecipes;if(!custom)return;
  const checked=new Set(),checkContext=(key,context)=>{
    if(!custom[key])return;const id=JSON.stringify([key,context]);if(checked.has(id))return;checked.add(id);
    check(new Set(matchingSources(custom[key],context).map(v=>typeof v==='string'?v:v.value)).size>=100,`${key}: 100 matching social variations are required for this context.`);
  };
  for(const h of g.homes.values())if(h.count>0) {
    const context=contextForPerson(map,g,g.primaryFor(h.homeId),{householdStyle:h.style});for(const key of [`household_${h.style}`,'domesticTasks','residentHabits','residentErrands'])checkContext(key,context);
  }
  for(const link of g.links.values()) {
    const context=contextForFact(map,g.facts.get(link.from),{scenario:link.scenario},g.people.get(link.supplierId).demographics);
    for(const key of [`story_${link.scenario}`,`goal_${link.scenario}`,'request','rumor'])checkContext(key,context);
  }
}
