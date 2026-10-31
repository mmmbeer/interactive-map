import { validateSocialSettings, validateSocialRecipes, validateHouseholdInputs } from './social/validation.js';
import { socialTokens } from './social/sections.js';
import { validateSettlement } from './economy-settlements.js';
import { economyTokens, tradeCatalog } from './economy-catalog.js';
import { catalogFor, configFor, dimensions, fields } from './config.js';
import { render } from './random.js';
import { nameStyles } from './locations-v2.js';
import { detailTokens } from './detail-helpers-v1.js';
import { validateDetailSources, validateDetailContext } from './detail-validation.js';
import { detailFields } from './details-v1.js';
export function check(condition,message) { if (!condition) throw new Error(message); }
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const safeKey = key => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(key) && !['__proto__','constructor','prototype'].includes(key);
const tokenTables = ['adjective','animal','symbol','street','detail','history','habit','task','complication'];
const v2Banks = ['root','waterRoot','streetRoot','epithet'];
const tokens = Object.fromEntries('first surname partnerSurname fullName label nameLabel subject race raceLabel gender age ageLabel culture wealth population district region map traits pronoun noun role service number houseNumber adjective animal symbol street detail history habit task complication root compound head water terrain landmark setting displayName address firstPossessive surnamePossessive fullNamePossessive epithetPossessive article'.split(' ').map(k => [k,'test']));
Object.assign(tokens,Object.fromEntries([...detailTokens,...economyTokens,...socialTokens].map(k=>[k,'test'])));
export function validateTables(tables,prefix,extra=[],strict=false) {
  check(object(tables),`${prefix}: tables must be an object.`);
  for (const [key,table] of Object.entries(tables)) {
    check(tokenTables.includes(key) || strict && v2Banks.includes(key) || [...fields,...extra].includes(key),`${prefix}: unknown table ${key}.`);
    check(Array.isArray(table) && table.length>0,`${prefix}: ${key} table cannot be empty.`);
    let total = 0;
    for (const item of table) {
      const value = object(item) ? item.value : item;
      const weight = object(item) ? item.weight ?? 1 : 1;
      check(text(value),`${prefix}: ${key} entries must contain text.`);
      check(Number.isFinite(weight) && weight>=0,`${prefix}: invalid ${key} weight.`); total += weight;
      // Token pools are literal values. Output templates alone expand tokens.
      if ([...fields,...extra].includes(key)) {
        if (strict) {
          check(!/[{}]/.test(value.replace(/\{[a-zA-Z][a-zA-Z0-9_]*\}/g,'')),`${prefix}: malformed template.`);
          check(key!=='name' || !value.includes('{displayName}') && !socialTokens.some(t=>value.includes('{'+t+'}')),`${prefix}: name cannot reference itself.`);
        }
        const available=strict ? tokens : Object.fromEntries(Object.entries(tokens).filter(([key])=>!['root','compound','head','water','terrain','landmark','setting','displayName','address','firstPossessive','surnamePossessive','fullNamePossessive','epithetPossessive','article'].includes(key)));
        render(value,available);
      }
    }
    check(Number.isFinite(total) && total>0,`${prefix}: ${key} needs positive weight.`);
  }
}
export function validateSettings(settings,prefix,catalog) {
  check(object(settings),`${prefix}: generation settings must be an object.`);
  check(Object.keys(settings).every(k => ['fields','demographics','tables','traits','seed','revision','version','nameStyle','settlement','trade','social'].includes(k)),`${prefix}: unknown generation setting.`);
  if (settings.version !== undefined) check([1,2].includes(settings.version),`${prefix}: unsupported generator version.`);
  if (settings.nameStyle !== undefined) check(catalog.version===2 && nameStyles.includes(settings.nameStyle),`${prefix}: unknown name style.`);
  if (settings.seed !== undefined) check(typeof settings.seed==='string' || Number.isFinite(settings.seed),`${prefix}: seed must be text or a finite number.`);
  if (settings.revision !== undefined) check(Number.isInteger(settings.revision) && settings.revision>=0,`${prefix}: revision must be a nonnegative integer.`);
  if (settings.fields !== undefined) check(Array.isArray(settings.fields) && settings.fields.every(f=>fields.includes(f) || Object.hasOwn(catalog.sections,f)) && new Set(settings.fields).size===settings.fields.length,`${prefix}: invalid generated fields.`);
  if (settings.traits !== undefined) check(Array.isArray(settings.traits) && settings.traits.every(text),`${prefix}: traits must be text values.`);
  if (settings.tables !== undefined) validateTables(settings.tables,prefix,Object.keys(catalog.sections),catalog.version===2);
  if (settings.trade!==undefined) check(typeof settings.trade==='string' && Object.hasOwn(tradeCatalog,settings.trade),`${prefix}: unknown trade focus.`);
  if (settings.social!==undefined) validateSocialSettings(settings.social,check,prefix);
  if (settings.settlement!==undefined) validateSettlement(settings.settlement,check,prefix);
  if (settings.demographics === undefined) return;
  const d = settings.demographics;
  check(object(d),`${prefix}: demographics must be an object.`);
  check(Object.keys(d).every(k => k==='population' || Object.hasOwn(dimensions,k) || Object.values(dimensions).includes(k)),`${prefix}: unknown demographic setting.`);
  for (const [single,plural] of Object.entries(dimensions)) {
    check(!(Object.hasOwn(d,single) && Object.hasOwn(d,plural)),`${prefix}: use ${single} or ${plural}, not both.`);
    const allowed = value => text(value) && safeKey(value) && (single==='race' ? Object.hasOwn(catalog.people,value) : single==='gender' ? ['female','male','nonbinary'].includes(value) : single==='culture' ? value==='ancestral' || Object.hasOwn(catalog.cultures,value) : true);
    if (d[single] !== undefined) check(allowed(d[single]),`${prefix}: unknown ${single} ${d[single]}.`);
    if (d[plural] !== undefined) {
      check(object(d[plural]) && Object.keys(d[plural]).length>0,`${prefix}: ${plural} needs weights.`);
      let total=0;
      for (const [value,weight] of Object.entries(d[plural])) {
        check(allowed(value),`${prefix}: unknown ${single} ${value}.`);
        check(Number.isFinite(weight) && weight>=0,`${prefix}: invalid ${plural} weight.`); total+=weight;
      }
      check(Number.isFinite(total) && total>0,`${prefix}: ${plural} needs positive weight.`);
    }
  }
  if (d.population !== undefined) check(Number.isInteger(d.population) && d.population>=0,`${prefix}: population must be a nonnegative integer.`);
}
export function validateGenerator(map,categories) {
  const g = map.generator;
  check(object(g) && [1,2].includes(g.version),'Unsupported generator version. Expected 1 or 2.');
  check(text(g.seed) || Number.isFinite(g.seed),'A generator needs a map seed.');
  check(g.detailsVersion===undefined || [1,2].includes(g.detailsVersion),'Unsupported detail catalog version.');
  check(g.socialVersion===undefined || g.socialVersion===1,'Unsupported social generator version.');
  const custom = g.catalog || {};
  check(object(custom) && Object.keys(custom).every(k => ['people','types','tables','cultures','sections','detailSources','socialRecipes'].includes(k)),'Invalid generation catalog.');
  validateSocialRecipes(map,check);
  validateDetailSources(map,check,value=>validateTables({description:[value]},'Detail source',[],true));
  for (const group of ['people','types','cultures','sections']) if (custom[group] !== undefined) check(object(custom[group]),`Catalog ${group} must be an object.`);
  const catalog = catalogFor(map);
  for (const [key,pool] of Object.entries(catalog.people)) {
    check(safeKey(key) && object(pool),`Invalid name pool: ${key}.`);
    for (const part of ['female','male','nonbinary','surnames']) check(Array.isArray(pool[part]) && pool[part].length>0 && pool[part].every(text),`${key}: missing ${part} names.`);
  }
  for (const [key,type] of Object.entries(catalog.types)) {
    check(safeKey(key) && object(type) && categories.includes(type.category) && text(type.label),`Invalid location type: ${key}.`);
    for (const part of ['nouns','roles','services']) check(Array.isArray(type[part]) && type[part].length>0 && type[part].every(text),`${key}: missing ${part}.`);
    if (type.tables !== undefined) validateTables(type.tables,key,Object.keys(catalog.sections),catalog.version===2);
  }
  for (const [key,culture] of Object.entries(catalog.cultures)) check(safeKey(key) && object(culture) && Object.hasOwn(catalog.people,culture.namePool),`Invalid culture: ${key}.`);
  for (const [key,section] of Object.entries(catalog.sections)) {
    check(safeKey(key) && !fields.includes(key) && (detailFields.includes(key) || !Object.hasOwn(tokens,key)) && object(section) && text(section.label),`Invalid custom section: ${key}.`);
    validateTables({[key]:section.templates},`Section ${key}`,Object.keys(catalog.sections),catalog.version===2);
  }
  if (custom.tables !== undefined) validateTables(custom.tables,'Catalog',Object.keys(catalog.sections),catalog.version===2);
  if (g.defaults !== undefined) {
    check(!Object.hasOwn(g.defaults,'version'),'Engine version belongs on the generator or an individual location.');
    validateSettings(g.defaults,'Map defaults',catalog);
  }
  return catalog;
}
export function validateResolvedSettings(map,place,catalog) {
  const {config} = configFor(map,place);
  validateSettings(config,place.id,catalog);
  validateDetailContext(map,place,config,check);
  if(map.generator.socialVersion===1)validateHouseholdInputs(place,config,check);
}

