import { choose, integer, bank, words } from './helpers-v2.js';

// Finite grammars may be small. Every compiled content recipe must have 100 outputs.
export function recipe(left, right, join = ' ') {
  const a = typeof left === 'string' ? words(left) : left;
  const b = typeof right === 'string' ? words(right) : right;
  return bank(a.flatMap(x => b.map(y => x + join + y)), 'Detail recipe');
}
export const detailTokens = new Set('meal guest lodging stock commission observance contract household portActivity routeNote waterNote terrainNote landmarkNote openingHours price'.split(' '));
export const conditionKeys = ['types','categories','wealths','traits','water','terrain','street'];
export function eligible(entry, context) {
  const when = typeof entry === 'object' ? entry.when || {} : {};
  return (!when.types || when.types.includes(context.type)) &&
    (!when.categories || when.categories.includes(context.category)) &&
    (!when.wealths || when.wealths.includes(context.wealth)) &&
    (!when.traits || when.traits.every(t => context.traits.includes(t))) &&
    ['water','terrain','street'].every(key => when[key] === undefined || when[key] === Boolean(context[key]));
}
export function matchingSources(entries, context) {
  return entries.filter(entry => eligible(entry, context) && (typeof entry !== 'object' || (entry.weight ?? 1) > 0));
}
// Weighted selection without replacement, including duplicate text under different conditions.
export function uniqueChoices(entries, count, rng, distinctBy = value => value) {
  const value = item => typeof item === 'string' ? item : item.value;
  if (!Array.isArray(entries)) throw new Error('Detail choices must be an array.');
  if (entries.length) choose(entries,()=>0); // Validate even entries that will be excluded.
  const pool = entries.filter(item => typeof item !== 'object' || (item.weight ?? 1) > 0);
  if (!Number.isSafeInteger(count) || count < 0 || count > new Set(pool.map(item=>distinctBy(value(item)))).size) throw new Error('Not enough distinct detail choices.');
  const selected = [];
  for (let i = 0; i < count; i++) {
    const chosen = choose(pool, rng);
    selected.push(chosen);
    for (let j = pool.length - 1; j >= 0; j--) if (distinctBy(value(pool[j])) === distinctBy(chosen)) pool.splice(j, 1);
  }
  return selected;
}
export function priceFor(wealth, rng, unit = 'meal') {
  const ranges = {meal:{modest:[2,5],comfortable:[6,12],wealthy:[15,30]},bed:{modest:[4,8],comfortable:[10,20],wealthy:[25,50]}};
  const range = ranges[unit]?.[wealth] || ranges[unit]?.modest;
  if (!range) throw new Error('Unknown price unit.');
  return `${integer(...range,rng)} sp`;
}
