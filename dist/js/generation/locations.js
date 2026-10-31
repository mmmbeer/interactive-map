import { prepareEconomy } from './economy.js';
import { random, pick, weighted, render } from './random.js';
import { resolveV2 } from './locations-v2.js';
import { versionFor } from './config.js';
import { prepareDetails } from './details-v1.js';
import { catalogFor, configFor, dimensions, districtList, availableFields } from './config.js';

const label = text => text.replaceAll('_',' ');
function contextFor(map, location, catalog) {
  const {config,district,region} = configFor(map,location);
  const base = [1,map.generationId ?? map.id,map.generator.seed,location.id,config.seed ?? '',config.revision ?? 0];
  const stream = (field,input = '') => random([base,field,input]);
  const demographics = {};
  for (const [single,plural] of Object.entries(dimensions)) {
    demographics[single] = config.demographics[single] ?? weighted(config.demographics[plural],stream(single,config.demographics[plural]));
  }
  if (config.demographics.population !== undefined) demographics.population = config.demographics.population;
  const type = catalog.types[location.type || location.category];
  if (!type) throw new Error(`Unknown location type: ${location.type}`);
  const profile = catalog.cultures[demographics.culture]?.namePool || demographics.race;
  const pool = catalog.people[profile];
  if (!pool) throw new Error(`No name pool for ${profile}. Add it to generator.catalog.people.`);
  const identitySeed = [demographics.race,demographics.gender,demographics.culture];
  const first = pick(pool[demographics.gender] || pool.nonbinary,stream('first',identitySeed));
  const surname = pick(pool.surnames,stream('surname',identitySeed));
  const partnerSurname = pick(pool.surnames.filter(n => n !== surname).length ? pool.surnames.filter(n => n !== surname) : pool.surnames,stream('partner-surname',identitySeed));
  const fullName = pick([
    {value:`${first} ${surname}`,weight:8}, {value:`${first} ${surname}-${partnerSurname}`,weight:1},
    {value:`${first} of ${district?.name || location.district}`,weight:1}
  ],stream('person-name',identitySeed));
  const setting = [demographics,location.type || location.category,district?.id,region?.id,config.traits];
  const roll = key => stream(key,setting);
  const sectionTables=Object.fromEntries(Object.entries(catalog.sections).map(([key,value])=>[key,value.templates]));
  const localTables = {...catalog.tables,...sectionTables,...type.tables,...map.generator.catalog?.tables,...config.tables};
  const token = key => pick(localTables[key],roll(`token:${key}`));
  const tokens = {
    first,surname,partnerSurname,fullName,label:type.label,
    race:demographics.race,raceLabel:label(demographics.race),gender:demographics.gender,
    age:demographics.age,ageLabel:label(demographics.age),culture:demographics.culture,
    wealth:label(demographics.wealth),population:demographics.population ?? 'unknown',
    district:district?.name || location.district,region:region?.name || map.region,map:map.name,
    traits:config.traits.join(', '), subject:demographics.gender === 'female' ? 'She' : demographics.gender === 'male' ? 'He' : 'They', nameLabel:type.label.replace(/\b\w/g,c=>c.toUpperCase()), pronoun:demographics.gender === 'female' ? 'she' : demographics.gender === 'male' ? 'he' : 'they',
    noun:pick(type.nouns,roll('noun')), role:pick(type.roles,roll('role')),service:pick(type.services,roll('service')),
    number:pick(['Third','Fifth','Seventh','Ninth','Twelfth'],roll('number')),
    houseNumber:Math.floor(roll('house-number')()*199)+1
  };
  for (const key of ['adjective','animal','symbol','street','detail','history','habit','task','complication']) tokens[key] = token(key);
  if (demographics.gender === 'nonbinary') {
    // Pools use third-person singular verbs. Keep neutral pronouns grammatical.
    tokens.habit = tokens.habit.replace(/^(keeps|remembers|collects|offers|repairs|always carries|knows|speaks|sends|hums|supports)\b/, word => ({keeps:'keep',remembers:'remember',collects:'collect',offers:'offer',repairs:'repair','always carries':'always carry',knows:'know',speaks:'speak',sends:'send',hums:'hum',supports:'support'}[word]));
  }
  const economy=prepareEconomy(map,location,{tokens,config,catalog,type});
  tokens.displayName=location.overrides?.name || (config.fields.includes('name') ? render(pick(localTables.name,roll('field:name')),tokens) : location.id);
  tokens.address=location.overrides?.address ?? render(pick(localTables.address,roll('field:address')),tokens);
  economy?.ready?.();
  prepareDetails(map,location,{tokens,config,context:economy?.context});
  economy?.finish();
  return {config,demographics,tokens,localTables,roll};
}
export function resolveLocation(map, location, catalog, stack) {
  catalog ||= catalogFor(map,location);
  if (!map.generator) return {...location}; // Legacy maps remain readable.
  if (versionFor(map,location) === 2) return resolveV2(map,location,resolveLocation,catalog,stack);
  if (versionFor(map,location) !== 1) throw new Error(`Unsupported generator version: ${map.generator.version}`);
  let context;
  const getContext = () => context ||= contextFor(map,location,catalog);
  const district = districtList(map).find(d => d.id === location.district);
  const result = {...location,districtId:location.district,district:district?.name || location.district};
  Object.defineProperty(result,'demographics',{enumerable:true,get:()=>getContext().demographics});
  const overrides = location.overrides || {};
  result.extra={};
  for (const field of availableFields(map)) {
    let cached;
    let ready = false;
    const isExtra=Object.hasOwn(catalog.sections,field);
    Object.defineProperty(isExtra ? result.extra : result,field,{enumerable:true,get() {
      if (!ready) {
        if (Object.hasOwn(overrides,field)) cached = overrides[field] ?? '';
        else if (getContext().config.fields.includes(field)) {
          const ctx=getContext();
          cached = field==='person' && location.category==='home' && ctx.demographics.population===0 ? '' : render(pick(ctx.localTables[field],ctx.roll(`field:${field}`)),ctx.tokens);
        } else cached = field === 'name' ? location.id : '';
        ready = true;
      }
      return isExtra ? {label:catalog.sections[field].label,text:cached} : cached;
    }});
  }
  return result;
}
export function materializeMap(source) {
  if (!source.generator) return source;
  if (![1,2].includes(source.generator.version)) throw new Error(`Unsupported generator version: ${source.generator.version}`);
  const catalog = catalogFor(source);
  const districtNames=new Map(districtList(source).map(d=>[d.id,d.name]));
  return {...source,districtAreas:districtList(source),districts:districtList(source).map(d => d.name),locations:source.locations.map(p => {
    if (versionFor(source,p) === 1) return resolveLocation(source,p,source.generator.version === 1 ? catalog : catalogFor(source,p));
    let cached;
    const result = {...p,districtId:p.district,district:districtNames.get(p.district) || p.district};
    for (const key of [...availableFields(source),'demographics','extra']) Object.defineProperty(result,key,{enumerable:true,get:()=> (cached ||= resolveLocation(source,p))[key]});
    return result;
  })};
}

