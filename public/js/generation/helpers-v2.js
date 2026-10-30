import { canonical, random } from './random.js';
// Version 2 helpers are strict. Released v1 behavior remains untouched.
export function words(text) { return text.trim().split(/\s*\|\s*/); }
export function bank(values, label = 'Word bank') {
  const result = [...new Set(values.map(v => v.trim()))];
  if (result.length < 100 || result.some(v => !v)) throw new Error(`${label} needs at least 100 distinct entries.`);
  return Object.freeze(result);
}
export function combine(left, right, join = ' ') {
  return words(left).flatMap(a => words(right).map(b => a + join + b));
}
export function choose(items, rng) {
  if (!Array.isArray(items) || !items.length) throw new Error('Cannot choose from an empty table.');
  if (!items.every(item=>typeof item==='string' && item.trim() || item && typeof item==='object' && typeof item.value==='string' && item.value.trim())) throw new Error('Generation entries must contain text.');
  const weights = items.map(item => item && typeof item === 'object' ? item.weight ?? 1 : 1);
  const total = weights.reduce((sum, n) => sum + n, 0);
  if (weights.some(n => !Number.isFinite(n) || n < 0) || !Number.isFinite(total) || total <= 0) throw new Error('Invalid generation weights.');
  const value = rng();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('Random source must return a number in [0, 1).');
  let roll = value * total, last;
  for (let i = 0; i < items.length; i++) {
    if (!weights[i]) continue;
    last = items[i]; roll -= weights[i];
    if (roll < 0) return typeof last === 'object' ? last.value : last;
  }
  return typeof last === 'object' ? last.value : last;
}
export function distribution(weights, rng) {
  return choose(Object.keys(weights).sort().map(value => ({value, weight:weights[value]})), rng);
}
export function integer(min, max, rng) {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min || !Number.isSafeInteger(max-min+1)) throw new Error('Invalid integer range.');
  const n = rng();
  if (!Number.isFinite(n) || n < 0 || n >= 1) throw new Error('Invalid random value.');
  return min + Math.floor(n * (max - min + 1));
}
export function sample(items, count, rng) {
  if (!Number.isInteger(count) || count < 0 || count > items.length) throw new Error('Invalid sample size.');
  const copy = [...items];
  for (let i = 0; i < count; i++) {
    const j = integer(i, copy.length - 1, rng); [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}
export function streams(seed) {
  // Validate once rather than allowing undefined / nonfinite inputs into a seed.
  const active=new WeakSet();
  const validate = value => {
    if (value === null || ['string','boolean'].includes(typeof value)) return;
    if (typeof value === 'number' && Number.isFinite(value)) return;
    if (Array.isArray(value) || value && typeof value==='object' && Object.getPrototypeOf(value)===Object.prototype) {
      if (active.has(value)) throw new Error('Seeds cannot contain cycles.');
      active.add(value);Object.values(value).forEach(validate);active.delete(value);return;
    }
    throw new Error('Seeds must contain finite JSON values.');
  };
  validate(seed);
  const stable = canonical(seed);
  return (label, input = '') => { validate(input); return random([2,stable,label,input]); };
}
export const title = text => text.replace(/\b\p{L}/gu, c => c.toUpperCase());
export const possessive = text => /s$/i.test(text) ? `${text}’` : `${text}’s`;
export const article = text => /^[aeiou]/i.test(text) ? 'an' : 'a';
