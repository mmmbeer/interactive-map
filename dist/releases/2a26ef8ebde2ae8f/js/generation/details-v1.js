import { detailSources } from './detail-sources-v1.js';
import { detailSourcesFor } from './detail-catalog.js';
import { streams } from './helpers-v2.js';
import { matchingSources, uniqueChoices, priceFor, detailTokens } from './detail-helpers-v1.js';
import { render } from './random.js';

const section = (label,token,categories) => ({label,templates:[`{${token}}`],categories});
export const detailSections = {
  meals:section('Meals','meal',['tavern']),
  guests:section('Guests and regulars','guest',['tavern']),
  lodgings:section('Guest rooms','lodging',['tavern']),
  stock:section('On the shelves','stock',['shop','workshop']),
  commissions:section('Current commissions','commission',['shop','workshop']),
  observances:section('Observances','observance',['temple']),
  contracts:section('Open contracts','contract',['guild']),
  household:section('Household','household',['home']),
  portActivity:section('At the quay','portActivity',['harbor']),
  routeNotes:section('Route records','routeNote',['street']),
  waterNotes:section('Water records','waterNote',['water']),
  terrainNotes:section('Land records','terrainNote',['terrain']),
  landmarkNotes:section('At the landmark','landmarkNote',['landmark']),
  openingHours:section('Visiting hours','openingHours',['shop','workshop','temple','guild','harbor'])
};
export const detailFields = Object.freeze(Object.keys(detailSections));

// Separate labeled streams preserve the released location engines and all existing fields.
export function detailContext(place,config,wealth) {
  return {type:place.type || place.category,category:place.category,wealth,traits:config.traits,
    water:place.context?.water,terrain:place.context?.terrain,street:place.context?.street};
}
export function sourceFor(field,context,custom={}) {
  if (field==='meals') return context.traits.includes('vegetarian') ? 'vegetarianMeals' : context.water ? 'waterMeals' : 'meals';
  if (field==='lodgings') return `lodging_${['modest','comfortable','wealthy'].includes(context.wealth) ? context.wealth : 'modest'}`;
  if (field==='stock') {
    const name=`stock_${context.type}`;
    return Object.hasOwn(custom,name) || Object.hasOwn(detailSources,name) ? name : 'stock_service';
  }
  return field;
}
export function prepareDetails(map,place,{tokens,config}) {
  // Honor displayed address overrides in additional content without rerolling legacy prose.
  const shared=tokens;
  tokens={...tokens,address:place.overrides?.address ?? tokens.address};
  const kind = place.type || place.category;
  const context = detailContext(place,config,tokens.wealth);
  const stream = streams(['details-v1',map.generationId ?? map.id,map.generator.seed,place.id,config.seed ?? '',config.revision ?? 0]);
  const input = [kind,place.category,context.wealth,config.traits,tokens.race,tokens.culture];
  const draw = (source,count=1) => {
    const values = map.generator.catalog?.detailSources?.[source] || detailSourcesFor(map)[source];
    if (!values) throw new Error(`Unknown detail source: ${source}`);
    const distinctBy = Object.hasOwn(map.generator.catalog?.detailSources || {},source) ? value=>value : source.endsWith('Meals') || source==='meals' ? value=>value.split(' with ')[0] :
      source.startsWith('stock_') ? value=>value.split('.')[0] : source==='guests' ? value=>value.split(/ (?:is|has) /)[0] : value=>value;
    const selected = uniqueChoices(matchingSources(values,context),count,stream(source,input),distinctBy);
    return selected.map(text=>render(text,tokens).replace(/([.!?])?$/,'.')).join(' ');
  };
  const enabled = field => config.fields.includes(field) && detailSections[field].categories.includes(place.category);
  // Tokens are shared with the existing person/name/service and geographic references.
  Object.assign(tokens,Object.fromEntries([...detailTokens].map(k=>[k,''])));
  const contact=Object.hasOwn(place.overrides || {},'person') ? 'the keeper' : tokens.fullName;
  if (enabled('meals')) {
    const source = sourceFor('meals',context);
    tokens.price=priceFor(tokens.wealth,stream('meal-price',input));
    tokens.meal=`At ${tokens.displayName}: ${draw(source,2)} Meals cost ${tokens.price} each.`;
  }
  if (enabled('guests')) tokens.guest=draw('guests',2);
  if (enabled('lodgings')) {
    const tier=['modest','comfortable','wealthy'].includes(tokens.wealth) ? tokens.wealth : 'modest';
    tokens.lodging=`${draw(`lodging_${tier}`)} A bed costs ${priceFor(tier,stream('bed-price',input),'bed')} per night. Book with ${contact}.`;
  }
  if (enabled('stock')) {
    const custom=map.generator.catalog?.detailSources || {};
    const source=sourceFor('stock',context,custom);
    tokens.stock=draw(source,3);
  }
  if (enabled('commissions')) tokens.commission=`Orders go through ${contact}. ${draw('commissions')}`;
  if (enabled('observances')) tokens.observance=draw('observances');
  if (enabled('contracts')) tokens.contract=draw('contracts',2);
  if (enabled('household')) {
    const population=config.demographics.population;
    tokens.household=population===0 ? `No permanent residents are recorded. ${draw('household')}` :
      `${population === undefined ? 'The household' : population===1 ? 'One resident' : `${population} residents`} at ${tokens.displayName}. ${draw('household')}`;
  }
  if (enabled('portActivity')) tokens.portActivity=`${tokens.displayName}${tokens.water ? `, beside ${tokens.water}` : ''}. ${draw('portActivity')}`;
  for (const field of ['routeNotes','waterNotes','terrainNotes','landmarkNotes']) if (enabled(field)) tokens[field.slice(0,-1)]=draw(field);
  if (enabled('openingHours')) tokens.openingHours=draw('openingHours');
  for (const key of detailTokens) shared[key]=tokens[key];
}
