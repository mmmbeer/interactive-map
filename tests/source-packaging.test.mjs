import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,writeFile,readFile,readdir,chmod,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve,dirname } from 'node:path';
import { gzipSync,gunzipSync } from 'node:zlib';
import { packageProceduralSource } from '../scripts/package-procedural-source.mjs';
import { readSourceParts,writeSourceParts } from '../scripts/source-parts.mjs';
import { assembleSource,validateSourceManifest } from '../public/js/source-download.js';

test('source packaging preserves equivalent gzip bytes and rebuilds changed source',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'atlas-package-test-'));
  const file=async(path,text)=>{await mkdir(dirname(resolve(root,path)),{recursive:true});await writeFile(resolve(root,path),text);};
  try {
    for(const path of ['public/js/app.js','scripts/build.mjs','sources/engines.json','sources/mapgen4/map.ts',
      'sources/probabletrain/vector.ts','sources/jsts-2.12.1-EDL.txt','package.json','package-lock.json',
      'LICENSE','AGENTS.md','docs/procedural-engines.md','node_modules/settlemaker/LICENSE','node_modules/settlemaker/NOTICE'])await file(path,path);
    await packageProceduralSource(root);
    const path=resolve(root,'public/licenses/procedural-source'),original=await readSourceParts(path),tar=gunzipSync(original);
    const alternative=gzipSync(tar,{level:1});assert.notDeepEqual(alternative,original);
    await writeSourceParts(path,alternative);
    await chmod(resolve(root,'public/js/app.js'),0o777);
    await packageProceduralSource(root);
    assert.deepEqual(await readSourceParts(path),alternative,'compression and local permissions must not change the release');
    await file('public/js/app.js','changed source');await packageProceduralSource(root);
    assert.notDeepEqual(gunzipSync(await readSourceParts(path)),tar,'source edits must rebuild the archive');
    const manifest=JSON.parse(await readFile(resolve(path,'manifest.json'),'utf8'));
    await writeFile(resolve(path,manifest.parts[0].name),'corrupt archive');await packageProceduralSource(root);
    assert.ok(gunzipSync(await readSourceParts(path)).includes(Buffer.from('changed source')));
  } finally {await rm(root,{recursive:true,force:true});}
});

test('source parts stay below the connector budget and the browser reconstructs exact bytes',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'atlas-parts-test-'));
  try {
    const bytes=Buffer.alloc(1200000);for(let i=0;i<bytes.length;i++)bytes[i]=i%251;
    await writeSourceParts(root,bytes);
    const manifest=JSON.parse(await readFile(resolve(root,'manifest.json'),'utf8'));
    assert.equal(manifest.parts.length,3);
    for(const p of manifest.parts)assert.ok(Buffer.byteLength(JSON.stringify({repository_full_name:'mmmbeer/interactive-map',content:(await readFile(resolve(root,p.name))).toString('base64'),encoding:'base64'}))<1024*1024);
    const assembled=await assembleSource(manifest,p=>readFile(resolve(root,p.name)));
    assert.deepEqual(Buffer.from(assembled),bytes);
    await assert.rejects(assembleSource(manifest,async()=>Buffer.from('tampered')),/checksum/);
    const changed=structuredClone(manifest);changed.sha256='0'.repeat(64);
    await assert.rejects(assembleSource(changed,p=>readFile(resolve(root,p.name))),/archive checksum/);
    const unsafe=structuredClone(manifest);unsafe.parts[0].name='../escape';
    assert.throws(()=>validateSourceManifest(unsafe),/source part/);
    const duplicate=structuredClone(manifest);duplicate.parts[1]=duplicate.parts[0];
    assert.throws(()=>validateSourceManifest(duplicate),/source part/);
    await writeSourceParts(root,Buffer.from('short'));
    const remaining=await readdir(root);
    assert.equal(remaining.filter(name=>name.endsWith('.bin')).length,1,'obsolete parts are removed');
  } finally {await rm(root,{recursive:true,force:true});}
});
