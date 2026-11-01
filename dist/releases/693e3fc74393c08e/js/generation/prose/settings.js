export const proseEnabled=map=>map.generator?.proseVersion===1;
export function defaultProse(map,place,config,field) {
  const custom=map.generator?.catalog;
  return !config.tables[field] && !custom?.tables?.[field] && !custom?.types?.[place.type || place.category]?.tables?.[field];
}
const contacts={tavern:'innkeeper',temple:'temple keeper',guild:'guild steward',harbor:'harbor keeper',landmark:'caretaker',
  graveyard:'graveyard keeper',cemetery:'cemetery keeper',necropolis:'memorial keeper',tomb:'tomb caretaker',crypt:'crypt caretaker',mausoleum:'mausoleum caretaker',grave:'memorial caretaker'};
const typeCache=new WeakMap();
export function proseTypes(map,types) {
  if(!proseEnabled(map))return types;
  if(typeCache.has(types))return typeCache.get(types);
  const result=Object.fromEntries(Object.entries(types).map(([key,type])=>{
    const role=contacts[key];
    return [key,role?{...type,roles:[role,...type.roles.filter(v=>v!==role)]}:type];
  }));
  typeCache.set(types,result);return result;
}
