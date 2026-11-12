import { execFileSync } from 'node:child_process';
import { mkdir,readdir,copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'public/licenses');
await mkdir(out,{recursive:true});
await copyFile(resolve(root,'node_modules/settlemaker/LICENSE'),resolve(out,'GPL-3.0.txt'));
await copyFile(resolve(root,'node_modules/settlemaker/NOTICE'),resolve(out,'settlemaker-NOTICE.txt'));
// Include the complete installed engine sources, host adapters, dependency
// sources and build inputs at the same URL as the distributed JavaScript.
// npm/esbuild executables are build tools, not part of the browser program.
const dependencies=(await readdir(resolve(root,'node_modules'))).filter(name=>!name.startsWith('.')&&!name.startsWith('@esbuild')&&name!=='esbuild').sort();
execFileSync('tar',['--sort=name','--mtime=@0','--owner=0','--group=0','--numeric-owner',
  '--exclude=*.map','--exclude=node_modules/settlemaker/dist','--exclude=node_modules/settlemaker/docs','-czf',resolve(out,'procedural-source.tar.gz'),
  'public/js','scripts','sources/engines.json','sources/mapgen4','sources/probabletrain','sources/jsts-2.12.1-EDL.txt','package.json','package-lock.json','LICENSE','AGENTS.md','docs/procedural-engines.md',
  ...dependencies.map(name=>'node_modules/'+name)],{cwd:root});
console.log('Packaged procedural corresponding source and build instructions.');
