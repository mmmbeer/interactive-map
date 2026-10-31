import { recipe } from './detail-helpers-v1.js';
const priorities={
  modest:'a repair before a replacement|a small initial quantity|an itemized estimate|standard materials|a reusable container|collection without an extra delivery charge|a practical finish|a shared delivery|the least costly suitable option|a staged order',
  comfortable:'a dependable finish|a matched set|a clear completion date|a choice of suitable materials|a documented specification|careful packing|a repeatable design|a reserve quantity|a convenient collection time|a sample before completion',
  wealthy:'a custom specification|a presentation copy|a dedicated collection appointment|a matching decorative finish|a separately packed order|a detailed provenance record|a signed sample|a commissioned design|a reserved production slot|a personalized presentation'
};
const requests='The customer requests|The buyer wants|The customer has asked for|The buyer has requested|The customer would like|The buyer’s preference is for|The customer’s instructions call for|The buyer is looking for|The customer prefers|The buyer has specified';
const compile=values=>recipe(requests,values.split('|').map(v=>`${v}.`));
export const budgetRecipes=Object.fromEntries(Object.entries(priorities).map(([key,values])=>[key,compile(values)]));
const workflowPriorities={
  service:{
    modest:'a short appointment|a shared booking|an itemized estimate|a basic service|a clear price in advance|a nearby appointment|the least costly suitable option|a single visit|a price without optional extras|a written breakdown of charges',
    comfortable:'a convenient appointment|a clear completion date|a choice of available times|a named contact|a written summary|a follow-up appointment|a clear scope of work|a confirmed booking|a flexible meeting time|a copy of the agreed terms',
    wealthy:'a dedicated appointment|a tailored service|a reserved time slot|a personal consultation|a detailed written report|a private appointment|a named specialist|a flexible schedule|a separately arranged visit|a full review of the requested work'
  },
  provisions:{
    modest:'a small initial quantity|an itemized estimate|a reusable container|collection without an extra delivery charge|a shared delivery|the least costly suitable option|a split order|a clear price per measure|a small sample before buying|a price without optional extras',
    comfortable:'a clear collection date|a reserve quantity|careful packing|a choice of available quantities|a sample before buying|a convenient collection time|a repeat order|a labeled delivery|a sealed container|a reliable supply',
    wealthy:'a reserved batch|a separately packed order|a dedicated collection appointment|a detailed source record|a choice of selected stock|a personalized selection|a reserved delivery slot|a larger sample selection|a specially prepared order|a standing reservation'
  }
};
export const workflowBudgets=Object.fromEntries(Object.entries(workflowPriorities).map(([workflow,values])=>[workflow,Object.fromEntries(Object.entries(values).map(([wealth,items])=>[wealth,compile(items)]))]));
export const budgetFor=(wealth,workflow)=>workflowBudgets[workflow]?.[wealth] || workflowBudgets[workflow]?.modest || budgetRecipes[wealth] || budgetRecipes.modest;
