import { versionFor } from './config.js';
import { check } from './validate.js';
const groups = {street:'street',water:'water',terrain:'terrain',landmark:'landmark'};
export function validateGeography(map) {
  const index = new Map(map.locations.map(p=>[p.id,p]));
  for (const p of map.locations) {
    if (p.context === undefined) continue;
    check(versionFor(map,p) === 2,`${p.id}: geographic context requires generator 2.`);
    check(p.context && typeof p.context==='object' && !Array.isArray(p.context),`${p.id}: context must be an object.`);
    for (const [key,id] of Object.entries(p.context)) {
      const target=index.get(id);
      check(Object.hasOwn(groups,key) && typeof id==='string' && target && target.id!==p.id,`${p.id}: invalid geographic reference ${key}.`);
      check(target.category===groups[key],`${p.id}: ${key} reference has the wrong category.`);
    }
  }
  const depths = new Map(), active = new Set();
  function visit(p) {
    if (depths.has(p.id)) return depths.get(p.id);
    check(!active.has(p.id),`${p.id}: cyclic geographic context.`);
    check(active.size<32,`${p.id}: geographic context is too deeply linked.`);
    active.add(p.id);
    let depth=1;
    for (const id of Object.values(p.context || {}))depth=Math.max(depth,1+visit(index.get(id)));
    check(depth<=32,`${p.id}: geographic context is too deeply linked.`);
    active.delete(p.id);depths.set(p.id,depth);return depth;
  }
  map.locations.forEach(visit);
}
