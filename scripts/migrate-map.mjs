import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { migrateMap, serializeMap } from '../public/js/authoring/model.js';
import { validateMap } from './validation.mjs';
const [file,...flags]=process.argv.slice(2);
if (!file || flags.some(flag=>flag!=='--regenerate-unfeatured')) {
  console.error('Usage: node scripts/migrate-map.mjs <map.json> [--regenerate-unfeatured]'); process.exit(1);
}
try {
  const path=resolve(file),input=await readFile(path,'utf8');
  const source=JSON.parse(input);
  validateMap(source);
  const map=migrateMap(source,{regenerateUnfeatured:flags.includes('--regenerate-unfeatured')});
  validateMap(map);
  const output=serializeMap(map);
  await writeFile(path,output);
  console.log(`Migrated ${map.id}. ${Buffer.byteLength(input)} → ${Buffer.byteLength(output)} bytes. IDs and geometry preserved.`);
} catch(error) { console.error(error.message); process.exitCode=1; }
