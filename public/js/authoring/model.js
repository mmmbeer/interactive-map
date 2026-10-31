import { numberSites } from '../site-index.js';
import { catalogFor } from '../generation/config.js';
const contentFields = ['name','description','person','rumor','address','services'];
export function migrateMap(input,{regenerateUnfeatured=false}={}) {
  const map = numberSites(structuredClone(input));
  if (map.generator) return map;
  map.schemaVersion=2;
  map.generator={version:1,seed:`${map.id}-v1`,defaults:{}};
  const ids=new Set();
  const districtIds=new Map();
  const names=map.districts || [...new Set(map.locations.map(p=>p.district))];
  map.districts=names.map(d=>{
    const name=typeof d==='string' ? d : d.name;
    const base=(typeof d==='object' ? d.id : name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')) || 'district';
    let id=base, n=2; while(ids.has(id)) id=`${base}-${n++}`;
    ids.add(id); districtIds.set(typeof d==='string' ? d : d.id,id);
    return {...(typeof d==='object'?d:{}),id,name};
  });
  for (const p of map.locations) {
    p.district=districtIds.get(p.district) || p.district;
    if (regenerateUnfeatured && !p.featured && !p.type) {
      const trade=p.description?.match(/^A neighborhood (.+?) serving/)?.[1] || p.description?.match(/^A working (.+?)’s shop/)?.[1];
      const type=trade==='baker' ? 'bakery' : trade?.replaceAll(' ','_');
      if (type && catalogFor(map).types[type]?.category===p.category) p.type=type;
    }
    const overrides={};
    for (const key of contentFields) {
      if (p[key] !== undefined && (!regenerateUnfeatured || p.featured)) overrides[key]=p[key];
      delete p[key];
    }
    if (Object.keys(overrides).length) p.overrides=overrides;
  }
  return map;
}
export function serializeMap(map) {
  const {locations,...metadata}=numberSites(map);
  const head=JSON.stringify(metadata,null,2).slice(0,-2);
  return head+',\n  "locations": [\n'+locations.map(p=>'    '+JSON.stringify(p)).join(',\n')+'\n  ]\n}\n';
}
export function newLocation(map,x=map.width/2,y=map.height/2) {
  const used=new Set(map.locations.map(p=>p.id));
  let n=1; while(used.has(`place-${String(n).padStart(4,'0')}`)) n++;
  return {id:`place-${String(n).padStart(4,'0')}`,category:'home',district:map.districts[0]?.id || map.districts[0],x,y,generation:{version:2,demographics:{}}};
}
export function saveLocation(map,place,originalId=null) {
  const result=numberSites(structuredClone(map)),index=originalId===null ? -1 : result.locations.findIndex(p=>p.id===originalId);
  if (originalId!==null && index<0) throw new Error('The edited location no longer exists.');
  if (originalId!==null && originalId!==place.id) throw new Error('Existing location ids cannot be changed.');
  if (index<0) {
    if(result.locations.some(p=>p.id===place.id)) throw new Error('A location with this id already exists.');
    result.locations.push(structuredClone(place));
  } else result.locations[index]=structuredClone(place);
  return numberSites(result);
}

