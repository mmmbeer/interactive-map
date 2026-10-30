import { readFile, access, readdir } from 'node:fs/promises';
import { resolve, extname, relative } from 'node:path';
export { categoryKeys, validateMap } from '../public/js/map-contract.js';
import { validateMap } from '../public/js/map-contract.js';
function assert(condition,message){if(!condition)throw new Error(message);}
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
