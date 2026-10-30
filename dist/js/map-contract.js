import { check, validateGenerator, validateSettings, validateResolvedSettings } from './generation/validate.js';
import { boundsFor } from './geometry.js';
export const categoryKeys = ['landmark','tavern','shop','workshop','temple','guild','harbor','home'];
const slug = value => typeof value==='string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const number = value => typeof value==='number' && Number.isFinite(value);
const text = value => typeof value==='string' && value.trim().length>0;
export function validateMap(map) {
  check(map && typeof map==='object' && !Array.isArray(map),'Map must be an object.');
  check(slug(map.id),'Map id must be a lowercase hyphenated slug.');
  for (const key of ['name','subtitle','description','image','thumbnail','region','theme']) check(text(map[key]),`Missing map ${key}.`);
  for(const key of ['image','thumbnail']) {
    const path=map[key];
    check(!path.includes('\\') && !path.split('/').includes('..') && !path.startsWith('/') && !/^[a-z]+:/i.test(path),`${key} must be a local relative asset path.`);
  }
  if(map.tags!==undefined) check(Array.isArray(map.tags) && map.tags.every(text),'Tags must be a list of text values.');
  check(number(map.width) && map.width>0 && number(map.height) && map.height>0,'Image dimensions must be positive numbers.');
  check(map.schemaVersion===undefined || [1,2].includes(map.schemaVersion),'Unsupported map schema version.');
  if (map.schemaVersion===2) check(Boolean(map.generator),'Schema version 2 requires a generator.');
  const catalog = map.generator ? validateGenerator(map,categoryKeys) : null;
  if(catalog) check(Array.isArray(map.districts) && map.districts.length>0,'Generated maps need district definitions.');
  const districts = new Set(), districtNames = new Set(), regions = new Set();
  check(map.regions===undefined || Array.isArray(map.regions),'Regions must be a list.');
  for (const r of map.regions || []) {
    check(r && slug(r.id) && text(r.name) && !regions.has(r.id),'Invalid or duplicate region.'); regions.add(r.id);
    if (r.generation !== undefined) { check(catalog,'Generation settings need a map generator.'); validateSettings(r.generation,r.id,catalog); }
  }
  check(map.districts===undefined || Array.isArray(map.districts),'Districts must be a list.');
  for (const d of map.districts || []) {
    const id = typeof d==='string' ? d : d?.id, name = typeof d==='string' ? d : d?.name;
    check(text(id) && text(name) && !districts.has(id) && !districtNames.has(name),'Invalid or duplicate district.'); districts.add(id); districtNames.add(name);
    if (typeof d==='object') {
      check(slug(id),'District ids must be slugs.');
      if (d.region !== undefined) check(regions.has(d.region),`${id}: unknown region.`);
      if (d.generation !== undefined) { check(catalog,'Generation settings need a map generator.'); validateSettings(d.generation,id,catalog); }
    }
  }
  check(Array.isArray(map.locations) && map.locations.length,'A map needs at least one location.');
  const ids = new Set();
  for (const p of map.locations) {
    const prefix = `${map.id}: ${p?.id || 'unnamed place'}`;
    check(p && slug(p.id),`${prefix}: invalid id.`);
    check(!ids.has(p.id),`${prefix}: duplicate id.`); ids.add(p.id);
    check(text(p.district),`${prefix}: missing district.`);
    if (map.districts) check(districts.has(p.district),`${prefix}: unknown district.`);
    if (p.region !== undefined) check(regions.has(p.region),`${prefix}: unknown region.`);
    check(categoryKeys.includes(p.category),`${prefix}: unsupported category.`);
    check(number(p.x) && p.x>=0 && p.x<=map.width && number(p.y) && p.y>=0 && p.y<=map.height,`${prefix}: point is outside the image.`);
    if (p.bounds !== undefined) check(Array.isArray(p.bounds) && p.bounds.length===4 && p.bounds.every(number),`${prefix}: invalid bounds.`);
    if (p.shape !== undefined) {
      check(!p.bounds || p.shape?.kind==='rectangle',`${prefix}: use bounds or a non-rectangle shape, not both.`);
      check(p.shape && ['point','rectangle','ellipse','polygon'].includes(p.shape.kind),`${prefix}: invalid shape.`);
      if (p.shape.kind==='ellipse') check(number(p.shape.rx) && p.shape.rx>0 && number(p.shape.ry) && p.shape.ry>0,`${prefix}: invalid ellipse.`);
      if (p.shape.kind==='polygon') {
        const pts=p.shape.points;
        check(Array.isArray(pts) && pts.length>=3 && pts.every(v=>Array.isArray(v) && v.length===2 && v.every(number)),`${prefix}: invalid polygon.`);
        const area=pts.reduce((sum,[x,y],i)=>{const [nx,ny]=pts[(i+1)%pts.length]; return sum+x*ny-nx*y;},0);
        check(Math.abs(area)>0,`${prefix}: polygon has no area.`);
      }
    }
    if (p.bounds || ['ellipse','polygon'].includes(p.shape?.kind)) {
      const [x,y,w,h]=boundsFor(p);
      check(x>=0 && y>=0 && w>0 && h>0 && x+w<=map.width && y+h<=map.height,`${prefix}: bounds are outside the image.`);
    }
    check(p.featured===undefined || typeof p.featured==='boolean',`${prefix}: featured must be a boolean.`);
    if (catalog) {
      if(p.type!==undefined) check(text(p.type) && Object.hasOwn(catalog.types,p.type),`${prefix}: unknown type.`);
      const type=catalog.types[p.type || p.category];
      check(type && type.category===p.category,`${prefix}: unknown or incompatible type.`);
      if (p.generation !== undefined) validateSettings(p.generation,prefix,catalog);
      validateResolvedSettings(map,p,catalog);
      if (p.overrides !== undefined) {
        check(p.overrides && typeof p.overrides==='object' && !Array.isArray(p.overrides),`${prefix}: overrides must be an object.`);
        for (const [key,value] of Object.entries(p.overrides)) check((['name','description','person','rumor','address','services'].includes(key) || Object.hasOwn(catalog.sections,key)) && (typeof value==='string' || value===null),`${prefix}: invalid override ${key}.`);
        if (p.overrides.name !== undefined) check(text(p.overrides.name),`${prefix}: override name cannot be empty.`);
      }
      check(!['name','description','person','rumor','address','services'].some(k=>Object.hasOwn(p,k)),`${prefix}: put authored text in overrides.`);
    } else {
      for (const key of ['name','description']) check(text(p[key]),`${prefix}: missing ${key}.`);
      for (const key of ['address','person','rumor']) check(p[key]===undefined || typeof p[key]==='string',`${prefix}: ${key} must be text.`);
    }
  }
  if (map.initialView) {
    const v=map.initialView;
    check(number(v.x) && number(v.y) && number(v.width) && v.x>=0 && v.x<=map.width && v.y>=0 && v.y<=map.height && v.width>0,'Invalid initial view.');
  }
  return map.locations.length;
}
