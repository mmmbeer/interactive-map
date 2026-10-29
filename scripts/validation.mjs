import { readFile, access, readdir } from 'node:fs/promises';
import { resolve, extname, relative } from 'node:path';
export const categoryKeys=['landmark','tavern','shop','workshop','temple','guild','harbor','home'];
const slug=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isNumber=value=>typeof value==='number'&&Number.isFinite(value);
function assert(condition,message){if(!condition)throw new Error(message);}
export function validateMap(map) {
  assert(slug.test(map.id),'Map id must be a lowercase hyphenated slug.');
  for(const key of ['name','subtitle','description','image','thumbnail','region','theme'])assert(typeof map[key]==='string'&&map[key].trim(),`Missing map ${key}.`);
  assert(isNumber(map.width)&&map.width>0&&isNumber(map.height)&&map.height>0,'Image dimensions must be positive numbers.');
  assert(Array.isArray(map.locations)&&map.locations.length,'A map needs at least one location.');
  const ids=new Set();
  for(const place of map.locations) {
    const prefix=`${map.id}: ${place.id||'unnamed place'}`;
    assert(typeof place.id==='string'&&slug.test(place.id),`${prefix}: invalid id.`);
    assert(!ids.has(place.id),`${prefix}: duplicate id.`);ids.add(place.id);
    for(const key of ['name','district','description'])assert(typeof place[key]==='string'&&place[key].trim(),`${prefix}: missing ${key}.`);
    for(const key of ['address','person','rumor'])assert(place[key]===undefined||typeof place[key]==='string',`${prefix}: ${key} must be text.`);
    assert(categoryKeys.includes(place.category),`${prefix}: unsupported category.`);
    assert(isNumber(place.x)&&place.x>=0&&place.x<=map.width&&isNumber(place.y)&&place.y>=0&&place.y<=map.height,`${prefix}: point is outside the image.`);
    if(place.bounds) {
      assert(Array.isArray(place.bounds)&&place.bounds.length===4&&place.bounds.every(isNumber),`${prefix}: invalid bounds.`);
      const[x,y,w,h]=place.bounds;
      assert(x>=0&&y>=0&&w>0&&h>0&&x+w<=map.width&&y+h<=map.height,`${prefix}: bounds are outside the image.`);
    }
    assert(place.featured===undefined||typeof place.featured==='boolean',`${prefix}: featured must be a boolean.`);
    if(map.districts)assert(map.districts.includes(place.district),`${prefix}: district is not in the map district list.`);
  }
  if(map.initialView){const v=map.initialView;assert(isNumber(v.x)&&isNumber(v.y)&&isNumber(v.width)&&v.x>=0&&v.x<=map.width&&v.y>=0&&v.y<=map.height&&v.width>0,'Invalid initial view.');}
  return map.locations.length;
}
export async function filesIn(directory) {
  const entries=await readdir(directory,{withFileTypes:true});
  return (await Promise.all(entries.filter(e=>!['.git','node_modules','dist','.openai'].includes(e.name)).map(e=>e.isDirectory()?filesIn(resolve(directory,e.name)):resolve(directory,e.name)))).flat();
}
export async function validateProject(root) {
  const publicRoot=resolve(root,'public');
  const readJSON=async path=>JSON.parse(await readFile(path,'utf8'));
  const index=await readJSON(resolve(publicRoot,'data/maps.json'));
  assert(Array.isArray(index)&&index.length>0,'The map index must contain at least one map.');
  const ids=new Set();let count=0;
  async function asset(path) {
    assert(typeof path==='string'&&!path.includes('\\')&&!path.split('/').includes('..')&&!path.startsWith('/')&&!/^[a-z]+:/i.test(path),`Use a relative asset path: ${path}`);
    await access(resolve(publicRoot,path));
  }
  for(const entry of index) {
    assert(!ids.has(entry.id),'Duplicate map in index.');ids.add(entry.id);
    await asset(entry.data);
    const map=await readJSON(resolve(publicRoot,entry.data));
    assert(entry.id===map.id,'Index and map ids do not match.');
    assert(entry.name===map.name,'Index and map names do not match.');
    const n=validateMap(map);count+=n;
    assert(entry.locationCount===n,`${map.id}: stale location count in map index.`);
    assert(entry.featuredCount===map.locations.filter(p=>p.featured).length,`${map.id}: stale featured count.`);
    for(const path of [map.image,map.thumbnail,entry.image,entry.thumbnail])await asset(path);
  }
  for(const file of await filesIn(root)) {
    if(!['.js','.mjs','.py','.css','.html'].includes(extname(file)))continue;
    const lines=(await readFile(file,'utf8')).trimEnd().split('\n').length;
    assert(lines<=500,`${relative(root,file)} exceeds the 500-line limit (${lines}).`);
  }
  return {maps:index.length,locations:count};
}
