import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,writeFile,readFile,chmod,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve,dirname } from 'node:path';
import { gzipSync,gunzipSync } from 'node:zlib';
import { packageProceduralSource } from '../scripts/package-procedural-source.mjs';

test('source packaging preserves equivalent gzip bytes and rebuilds changed source',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'atlas-package-test-'));
  const file=async(path,text)=>{await mkdir(dirname(resolve(root,path)),{recursive:true});await writeFile(resolve(root,path),text);};
  try {
    for(const path of ['public/js/app.js','scripts/build.mjs','sources/engines.json','sources/mapgen4/map.ts',
      'sources/probabletrain/vector.ts','sources/jsts-2.12.1-EDL.txt','package.json','package-lock.json',
      'LICENSE','AGENTS.md','docs/procedural-engines.md','node_modules/settlemaker/LICENSE','node_modules/settlemaker/NOTICE'])await file(path,path);
    await packageProceduralSource(root);
    const path=resolve(root,'public/licenses/procedural-source.tar.gz'),original=await readFile(path),tar=gunzipSync(original);
    const alternative=gzipSync(tar,{level:1});assert.notDeepEqual(alternative,original);
    await writeFile(path,alternative);
    await chmod(resolve(root,'public/js/app.js'),0o777);
    await packageProceduralSource(root);
    assert.deepEqual(await readFile(path),alternative,'compression and local permissions must not change the release');
    await file('public/js/app.js','changed source');await packageProceduralSource(root);
    assert.notDeepEqual(gunzipSync(await readFile(path)),tar,'source edits must rebuild the archive');
    await writeFile(path,'corrupt archive');await packageProceduralSource(root);
    assert.ok(gunzipSync(await readFile(path)).includes(Buffer.from('changed source')));
  } finally {await rm(root,{recursive:true,force:true});}
});
