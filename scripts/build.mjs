import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const root=resolve(import.meta.dirname,'..');
execFileSync(process.execPath,[resolve(root,'scripts/validate.mjs')],{stdio:'inherit'});
await rm(resolve(root,'dist'),{recursive:true,force:true});
await mkdir(resolve(root,'dist'),{recursive:true});
await cp(resolve(root,'public'),resolve(root,'dist'),{recursive:true});
console.log('Built Cloudflare Pages site in dist/.');
