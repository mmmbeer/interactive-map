import { detailSources } from './detail-sources-v1.js';
import { conditionKeys, detailTokens } from './detail-helpers-v1.js';
import { matchingSources } from './detail-helpers-v1.js';
import { detailContext, sourceFor, detailSections } from './details-v1.js';
import { canonical } from './random.js';
const text = v => typeof v==='string' && v.trim();
const object = v => v && typeof v==='object' && !Array.isArray(v);
const safe = k => /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(k) && !['__proto__','constructor','prototype'].includes(k);
export function validateDetailSources(map,check,validateTemplate) {
  checked.delete(map);
  const g=map.generator;
  const sources=g.catalog?.detailSources;
  if (sources === undefined) return;
  check(object(sources),'Detail sources must be an object.');
  for (const [key,entries] of Object.entries(sources)) {
    check(safe(key) && (Object.hasOwn(detailSources,key) || key.startsWith('stock_')),`Unknown detail source: ${key}.`);
    check(Array.isArray(entries) && entries.length>0,`${key}: detail source must be a nonempty array.`);
    const distinct=new Set();
    for (const entry of entries) {
      const value=object(entry) ? entry.value : entry;
      const weight=object(entry) ? entry.weight ?? 1 : 1;
      check(text(value) && Number.isFinite(weight) && weight>=0,`${key}: invalid detail text or weight.`);
      if (object(entry)) check(Object.keys(entry).every(k=>['value','weight','when'].includes(k)),`${key}: unknown detail source property.`);
      check(![...value.matchAll(/\{(\w+)\}/g)].some(m=>detailTokens.has(m[1])),`${key}: detail sources cannot reference other detail tokens.`);
      validateTemplate(value);
      if (weight>0) distinct.add(value);
      if (object(entry) && entry.when!==undefined) {
        check(object(entry.when),`${key}: invalid source conditions.`);
        for (const [condition,v] of Object.entries(entry.when)) {
          check(conditionKeys.includes(condition),`${key}: unknown source condition.`);
          if (['water','terrain','street'].includes(condition)) check(typeof v==='boolean',`${key}: context conditions must be boolean.`);
          else check(Array.isArray(v) && v.length>0 && v.every(text),`${key}: source conditions need text lists.`);
        }
      }
    }
    check(distinct.size>=100,`${key}: detail sources need 100 distinct positive-weight variations.`);
  }
}
const checked = new WeakMap();
export function validateDetailContext(map,place,config,check) {
  const custom=map.generator.catalog?.detailSources;
  if (!custom) return;
  let cache=checked.get(map);
  if (!cache) {cache=new Set();checked.set(map,cache);}
  const wealths=config.demographics.wealth ? [config.demographics.wealth] : Object.keys(config.demographics.wealths).filter(k=>config.demographics.wealths[k]>0);
  for (const wealth of wealths) {
    const context=detailContext(place,config,wealth);
    for (const [field,section] of Object.entries(detailSections)) {
      if (!config.fields.includes(field) || !section.categories.includes(place.category)) continue;
      const source=sourceFor(field,context,custom);
      if (!Object.hasOwn(custom,source)) continue;
      const key=canonical([source,context]);
      if (cache.has(key)) continue;
      const values=matchingSources(custom[source],context).map(v=>typeof v==='string' ? v : v.value);
      check(new Set(values).size>=100,`${place.id}: ${source} needs 100 matching variations for ${wealth}.`);
      cache.add(key);
    }
  }
}
