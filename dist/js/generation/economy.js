import { budgetFor } from './economy-budgets.js';
import { workflowFor, workRecipes, workRumors } from './economy-workflows.js';
import { tradeStockRecipes, industries } from './economy-catalog.js';
import { economicContext, chooseTrade, hasAuthoredTrade, materialIsLocal } from './economy-context.js';
import { supplyRecipes, guestRecipes } from './economy-recipes.js';
import { traditionFor, traditionRecipes } from './economy-traditions.js';
import { choose, streams, title, article } from './helpers-v2.js';
import { render } from './random.js';
import { uniqueChoices } from './detail-helpers-v1.js';

export const economySections={
  livelihood:{label:'Livelihood',templates:['{livelihoodNote}'],categories:['home','shop','workshop']},
  tradeLinks:{label:'Supplies and local demand',templates:['{tradeLinksNote}'],categories:['shop','workshop','guild','harbor']},
  craftTradition:{label:'Workshop tradition',templates:['{craftTraditionNote}'],categories:['shop','workshop']}
};
export function prepareEconomy(map,place,{tokens,config,catalog,type}) {
  Object.assign(tokens,{livelihoodNote:'',tradeLinksNote:'',craftTraditionNote:'',industry:'',trade:'',tradeRole:'',product:'',material:'',customer:'',workTask:'',supplyRoute:'',settlementType:'',tradition:'',budgetNote:''});
  if(['street','water','terrain','landmark'].includes(place.category))return null;
  if(place.category==='home' && config.demographics.population===0) {tokens.livelihoodNote='No resident livelihood is recorded for this unoccupied home.';return null;}
  if(place.category==='home' && Object.hasOwn(place.overrides || {},'person')) {tokens.livelihoodNote='The authored resident profile supplies this household’s occupation.';return null;}
  const context=economicContext(map,place,config,tokens);
  const custom=map.generator.catalog?.types?.[place.type || place.category];
  const trade=chooseTrade(map,place,config,context);
  if(hasAuthoredTrade(map,place,config) && place.category==='home') {tokens.livelihoodNote='The authored household profile supplies the occupation.';return null;}
  const industry=trade?.industry || (place.category==='tavern' ? 'hospitality' : place.category==='harbor' ? 'maritime' : place.category==='temple' ? 'civic' : null);
  if(!industry) {
    // Unknown authored trades use only the services the author supplied.
    if(['shop','workshop'].includes(place.category)) {
      tokens.livelihoodNote=`Work at ${tokens.district} concerns ${tokens.service}.`;
      if(economySections.tradeLinks.categories.includes(place.category))tokens.tradeLinksNote=`Local enquiries concern ${tokens.service}. Specifications are confirmed with the keeper.`;
      return {ready() {tokens.craftTraditionNote=`${tokens.displayName} records the customer’s preferred design with each request for ${tokens.service}.`;},finish() {}};
    }
    return null;
  }
  context.industry=industry;context.trade=trade?.id || '';
  const seed=['economy-details',map.generationId ?? map.id,map.generator.seed,place.id,config.seed ?? '',config.revision ?? 0];
  const stream=streams(seed),input=[context.settlementType,context.resources,context.industries,context.environment,tokens.race,tokens.culture,context.wealth];
  const draw=(key,values)=>choose(values,stream(key,input));
  const product=trade ? draw('product',trade.items) : draw('product',place.category==='tavern' ? ['hot meals','guest rooms','packed lunches','shared suppers','breakfasts','tea service','visitor messages','bed reservations','supper bookings','luggage storage'] : place.category==='harbor' ? ['cargo bookings','mooring reservations','passage records','freight receipts','loading appointments','pilot introductions','cargo tallies','storage bookings','boat deliveries','passage notices'] : ['memorial notices','quiet visits','care appointments','reading sessions','donation records','visitor introductions','observance bookings','community meals','remembrance records','pilgrim messages']);
  const material=draw('material',trade?.materials || industries[industry].materials);
  const tradition=traditionFor(tokens.race,tokens.culture,catalog);
  const route=tokens.water && ['river','canal','lake','bay','sea','channel','strait'].includes(context.waterType) && draw('route-kind',['road','water'])==='water' ? tokens.water : tokens.street || tokens.district;
  const preferredCustomers=industries[industry].customers.filter(c=>context.profile.customers.includes(c));
  const customers=preferredCustomers.length ? preferredCustomers : industries[industry].customers;
  Object.assign(tokens,{industry:industries[industry].label,trade:trade?.label || tokens.label,tradeRole:trade?.role || tokens.role,
    product,material,customer:draw('customer',customers),settlementType:context.profile.label,tradition:tradition.label,supplyRoute:route});
  const workflow=trade ? workflowFor(trade) : 'service';
  if(trade && ['shop','workshop','home'].includes(place.category) && !custom?.tables?.person)tokens.role=trade.role;
  if(trade && ['shop','workshop'].includes(place.category)) {
    tokens.service=`orders for ${product}`;
    if(['shop','workshop'].includes(place.type || place.category)) {
      tokens.label=trade.label;tokens.nameLabel=title(trade.label);tokens.article=article(trade.label);
      tokens.noun=title(trade.label);
    }
  }
  const overriddenBank=key=>config.tables[key] || map.generator.catalog?.tables?.[key] || type.tables?.[key];
  if(!overriddenBank('task'))tokens.task=render(draw('rumor',workRumors[workflow]),tokens);
  if(!overriddenBank('complication'))tokens.complication='';
  return {trade,context,ready() {
    // Keep the base engine's building details and history. Economic sections
    // describe the business without turning every paragraph into an order ledger.
    tokens.workTask=render(draw('task',workRecipes[workflow]),tokens);
    if(trade && economySections.livelihood.categories.includes(place.category) && config.demographics.population!==0)tokens.livelihoodNote=`The ${trade.role} serves ${tokens.customer} in ${tokens.district}.`;
    tokens.budgetNote=render(draw('budget',budgetFor(context.wealth,workflow)),tokens);
    const supply=render(draw('supply',supplyRecipes),tokens);
    if(economySections.tradeLinks.categories.includes(place.category))tokens.tradeLinksNote=`${supply} ${materialIsLocal(material,context) ? 'Supplies are sourced locally' : 'Supplies come from outside the settlement'}, via ${route}.`;
    if(economySections.craftTradition.categories.includes(place.category))tokens.craftTraditionNote=render(draw('tradition',traditionRecipes[tradition.key]),tokens)+'.';
  },finish() {
    const sources=map.generator.catalog?.detailSources || {};
    if(config.fields.includes('stock') && trade && ['shop','workshop'].includes(place.category) && !Object.hasOwn(sources,`stock_${trade.id}`) && !Object.hasOwn(sources,`stock_${place.type || place.category}`)) {
      const entries=tradeStockRecipes[`stock_${trade.id}`],head=product[0].toUpperCase()+product.slice(1)+'.';
      const focal=draw('focal-stock',entries.filter(v=>v.startsWith(head)));
      const others=uniqueChoices(entries.filter(v=>!v.startsWith(head)),2,stream('stock',input),v=>v.split('.')[0]);
      tokens.stock=`Available: ${[focal,...others].map(v=>render(v.split('.')[0],tokens)).join('; ')}.`;
    }
    if(config.fields.includes('commissions') && trade && ['shop','workshop'].includes(place.category) && !Object.hasOwn(sources,'commissions')) {
      const contact=Object.hasOwn(place.overrides || {},'person') ? 'the keeper' : tokens.fullName;
      tokens.commission=`Orders go through ${contact}. ${tokens.workTask} ${tokens.budgetNote}`;
    }
    if(config.fields.includes('contracts') && place.category==='guild' && trade && !Object.hasOwn(sources,'contracts'))tokens.contract=`${tokens.workTask} ${tokens.budgetNote}`;
    if(config.fields.includes('guests') && place.category==='tavern' && !Object.hasOwn(sources,'guests'))tokens.guest=uniqueChoices(guestRecipes[context.settlementType],2,stream('guests',input),v=>v.split(' asks ')[0].split(' compares ')[0]).map(v=>render(v,tokens)+'.').join(' ');
  }};
}
