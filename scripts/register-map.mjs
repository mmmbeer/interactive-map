import { readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateMap } from './validation.mjs';
const root=resolve(import.meta.dirname,'..','public');
const id=process.argv[2];
if(!id||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
  console.error('Usage: node scripts/register-map.mjs <map-id>');process.exit(1);
}
try {
  const map=JSON.parse(await readFile(resolve(root,`data/maps/${id}.json`),'utf8'));
  if(map.id!==id)throw new Error('The map id must match its filename.');
  validateMap(map);
  for(const key of ['image','thumbnail']) {
    const path=map[key];
    if(path.startsWith('/')||path.includes('..')||/^[a-z]+:/i.test(path))throw new Error('Use local public-relative asset paths.');
    await access(resolve(root,path));
  }
  for(const key of ['theme','region'])if(typeof map[key]!=='string'||!map[key].trim())throw new Error(`Missing ${key}.`);
  const path=resolve(root,'data/maps.json');
  const index=JSON.parse(await readFile(path,'utf8'));
  const entry=Object.fromEntries(['id','name','subtitle','description','image','thumbnail','theme','region','tags'].filter(key=>map[key]!==undefined).map(key=>[key,map[key]]));
  Object.assign(entry,{locationCount:map.locations.length,featuredCount:map.locations.filter(p=>p.featured).length,data:`data/maps/${id}.json`});
  const i=index.findIndex(map=>map.id===id);
  if(i<0)index.push(entry);else index[i]=entry;
  await writeFile(path,JSON.stringify(index,null,2)+'\n');
  console.log(`Registered ${map.name}: ${entry.locationCount} places, ${entry.featuredCount} highlights.`);
} catch(error){console.error(error.message);process.exitCode=1;}
