import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { validateProject, filesIn } from './validation.mjs';
const root=resolve(import.meta.dirname,'..');
try {
  const result=await validateProject(root);
  for(const file of await filesIn(root)) {
    if(/\.(mjs|js)$/.test(file))execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
  }
  console.log(`Validated ${result.maps} map(s), ${result.locations.toLocaleString()} locations, local assets, JavaScript syntax and the 500-line limit.`);
} catch(error) {console.error(error.message);process.exitCode=1;}
