import { householdRecipes, domesticTasks } from './household-recipes.js';
import { rumorRecipes, requestRecipes, residentHabits, residentErrands } from './story-recipes.js';
import { scenarios as ordinary } from './scenarios.js';
import { creativeScenarios } from './creative-scenarios.js';
import { recipe, matchingSources, uniqueChoices } from '../detail-helpers-v1.js';
import { render } from '../random.js';
export const scenarios={...ordinary,...creativeScenarios};
const frames='The shared account is precise:|The participants agree on this much:|The unresolved matter is recorded as follows:|The situation connecting the two places is this:|Both locations refer to one situation:|The account names the same participants:|The background to the request is clear:|The people involved describe this matter:|The request rests on this account:|The surviving account establishes this much:';
const references='The source is {fromPlace} in {fromDistrict}.|The other party is at {toPlace} in {toDistrict}.|The source address is {fromAddress}.|The destination address is {toAddress}.|Follow-up should identify both {supplier} and {buyer}.|The participants share this reference rather than separate versions.|The request belongs to this {settlementType} setting.|This is a connection between two mapped locations.|Both addresses are retained in the shared account.|The account identifies {requester} as the contact.';
const conditions='without changing the original account|with both parties’ observations recorded|before treating a possible lead as established|with the original reference returned to its keeper|after confirming the relevant names|using the same account at both locations|with any expenses agreed in advance|after checking the earlier notes|with uncertain details marked as uncertain|without substituting a different person or place';
export const socialSources={...householdRecipes,domesticTasks,residentHabits,residentErrands,rumor:rumorRecipes,request:requestRecipes,
  ...Object.fromEntries(Object.entries(scenarios).map(([key,s])=>[`story_${key}`,recipe(frames.split('|').map(v=>`${v} ${s.summary}`),references)])),
  ...Object.fromEntries(Object.entries(scenarios).map(([key,s])=>[`goal_${key}`,recipe(s.goals,conditions)]))
};
export const recipeTokens='headName memberNames householdCount domesticTask homePlace homeDistrict settlementType supplier buyer fromPlace toPlace fromDistrict toDistrict fromAddress toAddress requester product amount fact goal viewPlace district animalName animalType route'.split(' ');
export function sourceDraw(map,key,context,tokens,rng) {
  const entries=map.generator.catalog?.socialRecipes?.[key] || socialSources[key];
  if(!entries)throw new Error(`Unknown social recipe: ${key}`);
  const matching=matchingSources(entries,context);
  if(new Set(matching.map(v=>typeof v==='string'?v:v.value)).size<100)throw new Error(`${key}: 100 matching social recipe variations are required.`);
  return render(uniqueChoices(matching,1,rng)[0],tokens);
}
