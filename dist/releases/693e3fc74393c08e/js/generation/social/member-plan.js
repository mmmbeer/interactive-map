import { choose, sample, streams } from '../helpers-v2.js';
import { householdTypes } from './household-types.js';
import { adult } from './helpers.js';

const adultCohorts={
  mixed:['young_adult','adult','adult','elder'],
  working:['young_adult','adult','young_adult','adult'],
  older:['adult','elder','elder','young_adult']
};
const minorStages=['child','child','adolescent','adolescent'];

// Plan facts before resolving any names. Required household roles stay intact;
// extra slots use a shuffled cohort instead of copying the final template slot.
export function householdMemberPlan(map,home,primary) {
  const type=householdTypes[home.style],config=home.fact.config;
  const roll=streams(['household-member-plan-v1',map.generationId ?? map.id,map.generator.seed,home.homeId,config.seed ?? '',config.revision ?? 0]);
  const settlement=config.settlement?.type || 'city';
  const cohort=choose([
    {value:'mixed',weight:3},
    {value:'working',weight:settlement==='academy'?6:primary.age==='young_adult'?4:2},
    {value:'older',weight:primary.age==='elder'?5:settlement==='academy'?0:1}
  ],roll('cohort',[home.style,primary.age,settlement]));
  const adults=adultCohorts[cohort],bags=new Map();
  const stageAt=(offset,minors=false)=>{
    const block=Math.floor(offset/4),key=`${minors?'minor':'adult'}:${block}`;
    if(!bags.has(key))bags.set(key,sample(minors?minorStages:adults,4,roll(key,[home.style,cohort])));
    return bags.get(key)[offset%4];
  };
  return Array.from({length:Math.min(home.count,12)},(_,slot)=>{
    let role=type.roles[Math.min(slot,type.roles.length-1)],stage=type.stages[Math.min(slot,type.stages.length-1)];
    if(slot===0)stage=primary.age;
    if(slot>=type.stages.length) {
      const minors=['guardian_dependents','multigenerational'].includes(home.style);
      stage=stageAt(slot-type.stages.length,minors);
      if(home.style==='extended_family')role=stage==='young_adult'?'younger relative':stage==='elder'?'older relative':'adult relative';
      if(home.style==='care_household')role='caregiver';
    }
    if(!adult(primary.age)) {
      role=slot===0?'dependent':slot===1?'guardian':'relative';
      if(slot>0)stage=slot===1?'adult':stageAt(slot-2);
    }
    return {role,stage};
  });
}
