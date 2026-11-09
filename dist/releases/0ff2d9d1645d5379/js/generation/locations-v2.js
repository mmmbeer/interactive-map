import { prepareSharedIdentity, applySocialContent } from './social/runtime.js';
import { prepareEconomy } from './economy.js';
import { render } from './random.js';
import { catalogFor, configFor, dimensions, availableFields } from './config.js';
import { choose, distribution, streams, integer, title, possessive, article } from './helpers-v2.js';
import { featureText } from './geography-v2.js';
import { featureHeads } from './catalog-v2.js';
import { prepareDetails } from './details-v1.js';
import { proseDefaults, proseSectionLabel } from './prose/index.js';
import { defaultProse } from './prose/settings.js';
const labels = text => text.replaceAll('_',' ');
const styles = {
  descriptive:'{adjective} {root} {head}',simple:'{root} {head}',
  compound:'{compound} {head}',eponym:'{surnamePossessive} {head}',
  local:'{district} {root} {head}',poetic:'{head} of the {adjective} {animal}',
  historic:'{epithetPossessive} {head}',formal:'The {root} {head}',
  regional:'{root} {head} of {region}',paired:'{root} and {symbol} {head}',
  commemorative:'{firstPossessive} {root} {head}',traditional:'The {adjective} {head}'
};
const businessStyles = {
  descriptive:'{adjective} {noun}',simple:'{root} {nameLabel}',compound:'{compound} {nameLabel}',
  eponym:'{surnamePossessive} {nameLabel}',local:'{district} {nameLabel}',
  poetic:'The {animal}’s {noun}',historic:'{epithetPossessive} {nameLabel}',
  formal:'{fullNamePossessive} {nameLabel}',regional:'{nameLabel} of {region}',
  paired:'{surname} & {partnerSurname} {nameLabel}',commemorative:'{firstPossessive} {nameLabel}',
  traditional:'The {adjective} {nameLabel}'
};
export const nameStyles = Object.freeze(Object.keys(styles));
const cache = new WeakMap();
// Cache is scoped to an immutable source snapshot. Editing creates a new map object.
export function resolveV2(map, place, resolve, catalog = catalogFor(map,place), stack = new Set(), mode='full') {
  if (stack.has(place.id)) throw new Error(`Cyclic geographic context at ${place.id}.`);
  const path = new Set([...stack,place.id]);
  const {config,district,region} = configFor(map,place);
  const kind = place.type || place.category, type = catalog.types[kind];
  if (!type) throw new Error(`Unknown location type: ${kind}`);
  const feature = ['street','water','terrain'].includes(place.category);
  const stream = streams([map.generationId ?? map.id,map.generator.seed,place.id,config.seed ?? '',config.revision ?? 0]);
  const roll = (field,input='') => stream(field,input);
  const demographics = {};
  for (const [single,plural] of Object.entries(dimensions)) demographics[single] = config.demographics[single] ?? distribution(config.demographics[plural],roll(single,config.demographics[plural]));
  if (config.demographics.population !== undefined) demographics.population = config.demographics.population;
  const profile = catalog.cultures[demographics.culture]?.namePool || demographics.race;
  const pool = catalog.people[profile];
  if (!pool) throw new Error(`Unknown name pool: ${profile}`);
  const identity = [demographics.race,demographics.culture,demographics.gender];
  const first = choose(pool[demographics.gender],roll('first',identity));
  const surname = choose(pool.surnames,roll('surname',identity));
  const partnerSurname = choose(pool.surnames.filter(n=>n!==surname).length ? pool.surnames.filter(n=>n!==surname) : pool.surnames,roll('partner',identity));
  const fullName = `${first} ${surname}`;
  const sections = Object.fromEntries(Object.entries(catalog.sections).map(([k,v])=>[k,v.templates]));
  const tables = {...catalog.tables,...sections,...type.tables,...map.generator.catalog?.tables,...config.tables};
  const tokens = {
    ...demographics,raceLabel:labels(demographics.race),ageLabel:labels(demographics.age),population:demographics.population ?? 'unknown',
    first,surname,partnerSurname,fullName,firstPossessive:possessive(first),surnamePossessive:possessive(surname),fullNamePossessive:possessive(fullName),
    label:type.label,nameLabel:title(type.label),head:featureHeads[kind] || title(type.label),article:article(type.label),
    district:district?.name || place.district,region:region?.name || map.region,map:map.name,traits:config.traits.join(', '),
    pronoun:demographics.gender==='female' ? 'she' : demographics.gender==='male' ? 'he' : 'they',
    subject:demographics.gender==='female' ? 'She' : demographics.gender==='male' ? 'He' : 'They',
    noun:choose(type.nouns,roll('noun',kind)),role:choose(type.roles,roll('role',kind)),service:choose(type.services,roll('service',kind)),
    houseNumber:integer(1,199,roll('house-number')),number:String(integer(2,99,roll('number')))
  };
  for (const key of ['adjective','animal','symbol','street','detail','history','habit','task','complication']) tokens[key]=choose(tables[key],roll(`token:${key}`,kind));
  const rootBank = config.tables.root || map.generator.catalog?.tables?.root || type.tables?.root || tables[place.category==='water' ? 'waterRoot' : place.category==='street' ? 'streetRoot' : 'root'];
  tokens.root = choose(rootBank,roll('root',[kind,config.traits]));
  const otherRoots=rootBank.filter(w=>(typeof w==='object' ? w.value : w)!==tokens.root && (typeof w!=='object' || (w.weight ?? 1)>0));
  const second = choose(otherRoots.length ? otherRoots : rootBank,roll('compound-root',kind));
  tokens.compound = tokens.root + second.toLowerCase();
  tokens.epithetPossessive = possessive(choose(tables.epithet,roll('historic-name')));
  const context = {};
  const lookup = id => {
    let index=cache.get(map);
    if (!index) {index=new Map(map.locations.map(p=>[p.id,p]));cache.set(map,index);}
    const target=index.get(id);
    if (!target) throw new Error(`Unknown geographic reference: ${id}`);
    const name=resolve(map,target,undefined,path).name;
    return name;
  };
  for (const [key,id] of Object.entries(place.context || {})) context[key]=lookup(id);
  // A district's fallback street is shared by every unlinked building, rather than rolled per door.
  if (context.street) tokens.street=context.street;
  else if (!feature) tokens.street=choose(tables.street,streams([map.generationId ?? map.id,map.generator.seed,district?.id || place.district])('district-street'));
  tokens.water = context.water || '';
  tokens.terrain = context.terrain || '';
  tokens.landmark = context.landmark || '';
  tokens.setting = [context.street && `on ${context.street}`,context.water && `beside ${context.water}`,context.terrain && `near ${context.terrain}`,context.landmark && `near ${context.landmark}`].filter(Boolean).join(', ') || `on ${tokens.street}`;
  tokens.address = feature ? `${tokens.district}, ${tokens.region}` : `${tokens.houseNumber} ${tokens.street}`;
  const shared=prepareSharedIdentity(map,place,tokens,demographics);
  const economy=shared?.skipEconomy ? null : prepareEconomy(map,place,{tokens,config:shared?.config || config,catalog,type});
  const pattern = config.nameStyle ? (feature ? styles : businessStyles)[config.nameStyle] : null;
  const customName=config.tables.name || map.generator.catalog?.tables?.name || map.generator.catalog?.types?.[kind]?.tables?.name;
  const nameTemplate = !customName && pattern || choose(tables.name,roll('name-pattern',kind));
  const generatedName = render(nameTemplate,tokens);
  tokens.displayName = place.overrides?.name || (config.fields.includes('name') ? generatedName : place.id);
  if(mode==='identity')return {...place,name:tokens.displayName,address:place.overrides?.address ?? (config.fields.includes('address')?tokens.address:''),districtId:place.district,district:tokens.district,...(!feature?{demographics}:{} )};
  economy?.ready?.();
  const featureDefaults = feature ? featureText(kind,tokens,context,roll,place.category) : {};
  prepareDetails(map,place,{tokens,config,context:economy?.context});
  economy?.finish();
  const social=mode==='full' ? applySocialContent(map,place,{tokens,config,shared,resolve:(m,p)=>resolve(m,p,undefined,new Set(),'identity')}) : null;
  const prose=proseDefaults(map,place,{tokens,config,type,economy,social});
  const result = {...place,districtId:place.district,district:tokens.district,extra:{}};
  if (!feature) result.demographics=demographics;
  if(social)result.community=social.community;
  for (const field of availableFields(map)) {
    let value;
    if (Object.hasOwn(place.overrides || {},field)) value=place.overrides[field] ?? '';
    else if (!config.fields.includes(field)) value=field==='name' ? place.id : '';
    else if (field==='rumor' && social?.rumor) value=social.rumor;
    else if (field==='person' && social?.profile) value=social.profile;
    else if (field==='person' && place.category==='home' && demographics.population===0) value='';
    else if (field==='name') value=generatedName;
    else if (Object.hasOwn(prose,field) && defaultProse(map,place,config,field)) value=prose[field];
    else if (feature && Object.hasOwn(featureDefaults,field) && !config.tables[field] && !map.generator.catalog?.tables?.[field]) value=featureDefaults[field];
    else value=render(choose(tables[field],roll(`field:${field}`,kind)),tokens);
    if (Object.hasOwn(catalog.sections,field)) result.extra[field]={label:proseSectionLabel(map,place,field,catalog.sections[field].label,economy),text:value};
    else result[field]=value;
  }
  return result;
}
