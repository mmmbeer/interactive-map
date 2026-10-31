import { recipe } from './detail-helpers-v1.js';
const priorities={
  modest:'a repair before a replacement|a small initial quantity|an itemized estimate|standard materials|a reusable container|collection without an extra delivery charge|a practical finish|a shared delivery|the least costly suitable option|a staged order',
  comfortable:'a dependable finish|a matched set|a clear completion date|a choice of suitable materials|a documented specification|careful packing|a repeatable design|a reserve quantity|a convenient collection time|a sample before completion',
  wealthy:'a custom specification|a presentation copy|a dedicated collection appointment|a matching decorative finish|a separately packed order|a detailed provenance record|a signed sample|a commissioned design|a reserved production slot|a personalized presentation'
};
const records='The request is attached to the {product} order.|The buyer is recorded among {customer}.|The keeper confirms terms at {displayName}.|The order references {trade} work.|The estimate is filed in {district}.|The collection route is {supplyRoute}.|Changes need the customer’s approval.|The accepted specification remains on file.|The receipt lists the agreed terms.|The buyer receives a copy of the estimate.';
export const budgetRecipes=Object.fromEntries(Object.entries(priorities).map(([key,values])=>[key,recipe(values.split('|').map(v=>`The customer requests ${v}.`),records)]));
