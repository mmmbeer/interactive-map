import { defaults, people, tables, types } from './catalog-v1.js';
import * as v2 from './catalog-v2.js';
export const versionFor = (map, location) => location?.generation?.version ?? map.generator?.version ?? 1;
export const fields = ['name','description','person','rumor','address','services'];
export const dimensions = {race:'races',gender:'genders',age:'ages',culture:'cultures',wealth:'wealths'};
export function districtList(map) {
  return (map.districts || []).map(d => typeof d === 'string' ? {id:d,name:d} : d);
}
export function regionList(map) { return map.regions || []; }
export function catalogFor(map, location) {
  const base = versionFor(map,location) === 2 ? v2 : {people,types,tables};
  const custom = map.generator?.catalog || {};
  return {version:versionFor(map,location),people:{...base.people,...custom.people}, types:{...base.types,...custom.types}, tables:{...base.tables,...custom.tables}, cultures:custom.cultures || {},sections:custom.sections || {}};
}
export function availableFields(map) { return [...fields,...Object.keys(map.generator?.catalog?.sections || {})]; }
export function configFor(map, location) {
  const district = districtList(map).find(d => d.id === location.district);
  const region = regionList(map).find(r => r.id === (location.region || district?.region));
  const layers = [defaults,map.generator?.defaults,region?.generation,district?.generation,location.generation].filter(Boolean);
  const config = {fields:fields,demographics:{},tables:{},traits:[]};
  for (const layer of layers) {
    Object.assign(config, {...layer, demographics:config.demographics, tables:config.tables});
    Object.assign(config.tables,layer.tables);
    for (const [single,plural] of Object.entries(dimensions)) {
      if (Object.hasOwn(layer.demographics || {},single)) delete config.demographics[plural];
      else if (Object.hasOwn(layer.demographics || {},plural)) delete config.demographics[single];
    }
    Object.assign(config.demographics,layer.demographics);
  }
  return {config,district,region};
}

