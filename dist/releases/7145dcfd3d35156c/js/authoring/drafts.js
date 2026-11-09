import { validateMap } from '../map-contract.js';
import { serializeMap } from './model.js';
const key = id => `wandering-atlas:draft:${id}`;
export function fingerprint(map) {
  let hash=2166136261;
  for (const char of JSON.stringify(map)) hash=Math.imul(hash^char.charCodeAt(0),16777619);
  return (hash>>>0).toString(16);
}
export function readDraft(published,storage) {
  try {
    storage ||= globalThis.localStorage;
    const raw=storage.getItem(key(published.id));
    if (!raw) return {map:published};
    const draft=JSON.parse(raw);
    validateMap(draft.map);
    if (draft.map.id!==published.id) throw new Error('Draft map id does not match.');
    if (draft.base!==fingerprint(published)) return {map:published,stale:draft.map};
    return {map:draft.map,local:true};
  } catch { return {map:published,unavailable:true}; }
}
export function writeDraft(map,published,storage) {
  validateMap(map);
  if (map.id!==published.id) throw new Error('A draft must keep the published map id.');
  try {
    storage ||= globalThis.localStorage;
    storage.setItem(key(map.id),JSON.stringify({base:fingerprint(published),map}));
  } catch {
    throw new Error('Could not save the draft. Browser storage is unavailable or full. Export map JSON to keep these changes.');
  }
}
export function clearDraft(id,storage=globalThis.localStorage) { storage.removeItem(key(id)); }
export function downloadMap(map) {
  validateMap(map);
  const blob=new Blob([serializeMap(map)],{type:'application/json'}),url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url;a.download=`${map.id}.json`;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
