import { householdRecipes, domesticTasks } from './household-recipes.js';
import { rumorRecipes, requestRecipes, residentHabits, residentErrands } from './story-recipes.js';
import { scenarios as ordinary } from './scenarios.js';
import { creativeScenarios } from './creative-scenarios.js';
import { matchingSources, uniqueChoices } from '../detail-helpers-v1.js';
import { situationSources } from './situation-prose.js';
import { render } from '../random.js';
export const scenarios={...ordinary,...creativeScenarios};
export const socialSources={...householdRecipes,domesticTasks,residentHabits,residentErrands,rumor:rumorRecipes,request:requestRecipes,
  ...situationSources(scenarios)
};
export const recipeTokens='headName memberNames householdCount domesticTask homePlace homeDistrict settlementType supplier buyer fromPlace toPlace fromDistrict toDistrict fromAddress toAddress requester product productName item amount fact goal viewPlace district animalName animalType route'.split(' ');
export function sourceDraw(map,key,context,tokens,rng) {
  const entries=map.generator.catalog?.socialRecipes?.[key] || socialSources[key];
  if(!entries)throw new Error(`Unknown social recipe: ${key}`);
  const matching=matchingSources(entries,context);
  if(new Set(matching.map(v=>typeof v==='string'?v:v.value)).size<100)throw new Error(`${key}: 100 matching social recipe variations are required.`);
  return render(uniqueChoices(matching,1,rng)[0],tokens);
}
