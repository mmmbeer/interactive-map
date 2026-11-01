import { settlementTypes } from './economy-settlements.js';
import { catalogFor } from './config.js';
import { ancestries, settlementProfiles, settlementPeople } from './settlement-pools-v1.js';

export function defaultSettings(source) {
  return {ancestry:'human',seed:String(source.generator?.seed ?? '')};
}
export function normalizeSettings(source,input={}) {
  const defaults=defaultSettings(source);
  const ancestry=input.ancestry ?? defaults.ancestry,seed=input.seed ?? defaults.seed;
  if (typeof ancestry!=='string' || ancestry!=='original' && !Object.hasOwn(ancestries,ancestry)) throw new Error('Choose a supported ancestry.');
  if (typeof seed!=='string' || !seed.trim() || seed.length>128) throw new Error('Enter a seed of 1 to 128 characters.');
  const settlementType=input.settlementType;
  if (settlementType!==undefined && settlementType!=='original' && !Object.hasOwn(settlementTypes,settlementType)) throw new Error('Choose a supported settlement type.');
  return {ancestry,seed,...(settlementType && settlementType!=='original' ? {settlementType} : {})};
}
const storageKey=id=>`wandering-atlas:generation:${id}`;
export function readSettings(source,url,storage) {
  const params=new URL(url).searchParams;
  // Shared links carry both settings and take priority over this device's preferences.
  if (params.has('ancestry') || params.has('seed') || params.has('settlement')) {
    try { return normalizeSettings(source,{ancestry:params.get('ancestry') ?? undefined,seed:params.get('seed') ?? undefined,settlementType:params.get('settlement') ?? undefined}); }
    catch { return defaultSettings(source); }
  }
  try {
    storage ||= globalThis.localStorage;
    const raw=storage.getItem(storageKey(source.id));
    return normalizeSettings(source,raw ? JSON.parse(raw) : source.settlementSettings || {});
  } catch {
    try {return normalizeSettings(source,source.settlementSettings || {});}
    catch {return defaultSettings(source);}
  }
}
export function saveSettings(source,settings,storage) {
  const normalized=normalizeSettings(source,settings);
  try {
    storage ||= globalThis.localStorage;
    storage.setItem(storageKey(source.id),JSON.stringify(normalized));return true;
  } catch { return false; }
}
export function settingsURL(url,settings) {
  const result=new URL(url);
  result.searchParams.set('ancestry',settings.ancestry);
  result.searchParams.set('seed',settings.seed);
  if(settings.settlementType)result.searchParams.set('settlement',settings.settlementType);
  else result.searchParams.delete('settlement');
  return result;
}
export function applySettings(source,settings) {
  if (!source.generator) return source;
  const {ancestry,seed,settlementType}=normalizeSettings(source,settings);
  // Keep numeric source seeds numeric when unchanged. Visitor input is otherwise literal text.
  const generator={...source.generator,seed:seed===String(source.generator.seed) ? source.generator.seed : seed};
  const withSettlement=map=>!settlementType ? map : {...map,generator:{...map.generator,defaults:{...map.generator.defaults,settlement:{...map.generator.defaults?.settlement,type:settlementType}}},locations:map.locations.map(p=>({...p,generation:{...p.generation,settlement:{...p.generation?.settlement,type:settlementType}}}))};
  if (ancestry==='original') return withSettlement({...source,generator});
  const profile=settlementProfiles[ancestry],custom=source.generator.catalog || {};
  if (profile) {
    const catalog=catalogFor(source),v2=source.generator.version===2;
    const business=v2 ? [
      '{root} {nameLabel}','{root} & {surname} {nameLabel}','{surnamePossessive} {nameLabel}',
      '{firstPossessive} {root} {nameLabel}','{surname} & {partnerSurname} {nameLabel}',
      'The {root} {nameLabel}','{fullNamePossessive} {nameLabel}','{root} {nameLabel} of {district}'
    ] : ["{surname}'s {nameLabel}",'{adjective} {nameLabel}',"{first}'s {nameLabel}",'{surname} & {partnerSurname} {nameLabel}'];
    const geographic=[
      '{root} {head}','{surnamePossessive} {root} {head}','{surnamePossessive} {head}',
      '{district} {root} {head}','{firstPossessive} {root} {head}','The {root} {head}'
    ];
    const types=Object.fromEntries(Object.entries(catalog.types).map(([key,type])=>[key,{
      ...type,tables:{...type.tables,
        ...(v2 ? {root:type.category==='water' ? profile.waterRoots : type.category==='street' ? profile.streetRoots : profile.roots} : {}),
        name:['street','water','terrain'].includes(type.category) ? geographic : business,...custom.types?.[key]?.tables}
    }]));
    const themed={adjective:profile.roots,street:profile.streetRoots.map(root=>`${root} Street`)};
    if (v2) Object.assign(themed,{waterRoot:profile.waterRoots,streetRoot:profile.streetRoots,epithet:profile.surnames});
    generator.catalog={...custom,types,tables:{...themed,...custom.tables},people:{[ancestry]:settlementPeople(ancestry),...custom.people}};
  }
  // A visitor's settlement choice takes precedence over authored demographic distributions.
  // Only the read-time snapshot changes. Authored overrides and all geometry stay intact.
  const locations=source.locations.map(place=>{
    const demographics={...place.generation?.demographics,race:ancestry,culture:'ancestral'};
    delete demographics.races;delete demographics.cultures;
    return {...place,generation:{...place.generation,demographics}};
  });
  return withSettlement({...source,generator,locations});
}
