import { execFileSync } from 'node:child_process';
import { mkdir,readdir,copyFile,mkdtemp,readFile,writeFile,rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { gzipSync,gunzipSync } from 'node:zlib';
import { readSourceParts,writeSourceParts } from './source-parts.mjs';

export async function packageProceduralSource(root) {
const out=resolve(root,'public/licenses');
await mkdir(out,{recursive:true});
await copyFile(resolve(root,'node_modules/settlemaker/LICENSE'),resolve(out,'GPL-3.0.txt'));
await copyFile(resolve(root,'node_modules/settlemaker/NOTICE'),resolve(out,'settlemaker-NOTICE.txt'));
// Include the complete installed engine sources, host adapters, dependency
// sources and build inputs at the same URL as the distributed JavaScript.
// npm/esbuild executables are build tools, not part of the browser program.
const dependencies=(await readdir(resolve(root,'node_modules'))).filter(name=>!name.startsWith('.')&&!name.startsWith('@esbuild')&&name!=='esbuild').sort();
const temp=await mkdtemp(resolve(tmpdir(),'atlas-source-'));
try {
execFileSync('tar',['--sort=name','--format=gnu','--mtime=@0','--owner=0','--group=0','--numeric-owner',
  '--mode=a=,a+r,u+w,a+X',
  '--exclude=*.map','--exclude=node_modules/settlemaker/dist','--exclude=node_modules/settlemaker/docs','-cf',resolve(temp,'source.tar'),
  'public/js','scripts','sources/engines.json','sources/mapgen4','sources/probabletrain','sources/jsts-2.12.1-EDL.txt','package.json','package-lock.json','LICENSE','AGENTS.md','docs/procedural-engines.md',
  ...dependencies.map(name=>'node_modules/'+name)],{cwd:root,env:{...process.env,LC_ALL:'C'}});
const tar=await readFile(resolve(temp,'source.tar')),directory=resolve(out,'procedural-source');
// gzip implementations can emit different bytes for identical tar contents.
// Keep a valid committed encoding when it contains exactly the rebuilt source.
let previous;
try {previous=await readSourceParts(directory);if(!gunzipSync(previous).equals(tar))previous=null;}
catch(error) {if(error.code&&error.code!=='ENOENT'&&!error.code.startsWith('Z_'))throw error;previous=null;}
await writeSourceParts(directory,previous||gzipSync(tar,{level:9}));
} finally { await rm(temp,{recursive:true,force:true}); }
console.log('Packaged procedural corresponding source and build instructions.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await packageProceduralSource(resolve(import.meta.dirname,'..'));
