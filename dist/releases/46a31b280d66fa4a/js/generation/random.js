// Version 1: keep this algorithm stable. New algorithms need a new generator version.
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
export function random(seed) {
  const text = canonical(seed);
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) { h = Math.imul(h ^ text.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); h ^= h >>> 16;
  return () => {
    let t = h += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function pick(items, rng) {
  if (!items?.length) throw new Error('A generation table cannot be empty.');
  const weights = items.map(item => typeof item === 'object' ? item.weight ?? 1 : 1);
  const total = weights.reduce((sum, n) => sum + n, 0);
  if (!(total > 0)) throw new Error('A generation table needs positive weight.');
  let roll = rng() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll < 0) return typeof items[i] === 'object' ? items[i].value : items[i];
  }
  return typeof items.at(-1) === 'object' ? items.at(-1).value : items.at(-1);
}
export function weighted(weights, rng) {
  return pick(Object.keys(weights).sort().map(value => ({value, weight: weights[value]})), rng);
}
export function render(template, tokens) {
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (all, key) => {
    if (!Object.hasOwn(tokens, key)) throw new Error(`Unknown generation token: ${key}`);
    return String(tokens[key]);
  });
}
