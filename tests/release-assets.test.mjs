import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {versionAssets} from '../scripts/release-assets.mjs';
const root=new URL('..',import.meta.url).pathname;
test('a changed nested dependency gives the complete module graph a new URL',async()=>{
  const temp=await mkdtemp(resolve(tmpdir(),'atlas-release-'));
  try {
    const source=resolve(temp,'public'),output=resolve(temp,'dist');
    await mkdir(resolve(source,'js/nested'),{recursive:true});await mkdir(resolve(source,'css'));
    await writeFile(resolve(source,'index.html'),'<link href="css/map.css"><script type="module" src="js/app.js"></script><img src="assets/map.webp">');
    await writeFile(resolve(source,'js/app.js'),"export {category} from './nested/contract.js';");
    await writeFile(resolve(source,'js/nested/contract.js'),"export const category='home';");
    await writeFile(resolve(source,'css/map.css'),'body{color:black}');
    const first=await versionAssets(source,output);
    assert.equal(await versionAssets(source,output),first,'Unchanged builds must be reproducible.');
    await writeFile(resolve(source,'js/nested/contract.js'),"export const category='water';");
    const second=await versionAssets(source,output);assert.notEqual(second,first);
    const html=await readFile(resolve(output,'index.html'),'utf8');
    assert.ok(html.includes(`src="releases/${second}/js/app.js"`));assert.ok(html.includes(`href="releases/${second}/css/map.css"`));
    assert.ok(html.includes('src="assets/map.webp"'));
    const entry=resolve(output,`releases/${second}/js/app.js`);
    const code=await readFile(entry,'utf8'),importPath=code.match(/from '([^']+)'/)[1];
    const dependency=resolve(dirname(entry),importPath);
    assert.ok(dependency.includes(`/releases/${second}/`));
    assert.equal((await import(pathToFileURL(dependency))).category,'water');
    assert.equal((await import(pathToFileURL(resolve(output,`releases/${first}/js/nested/contract.js`)))).category,'home');
  } finally {await rm(temp,{recursive:true,force:true});}
});
test('the production release graph validates the current geographic map',async()=>{
  const temp=await mkdtemp(resolve(tmpdir(),'atlas-map-release-'));
  try {
    const release=await versionAssets(resolve(root,'public'),temp),prefix=resolve(temp,`releases/${release}/js`);
    const {validateMap}=await import(pathToFileURL(resolve(prefix,'map-contract.js')));
    const source=JSON.parse(await readFile(resolve(root,'public/data/maps/dragonsgate.json'),'utf8'));
    assert.equal(validateMap(source),7109);
    const seen=new Set();
    async function visit(path) {
      if(seen.has(path)) return;seen.add(path);
      assert.ok(path.startsWith(prefix+'/'),'Every module must belong to the same release.');
      const code=await readFile(path,'utf8');
      for(const match of code.matchAll(/(?:from\s*|import\s*)['"]([^'"]+\.js)['"]/g)) await visit(resolve(dirname(path),match[1]));
    }
    await visit(resolve(prefix,'app.js'));assert.ok(seen.size>=20);
    const headers=await readFile(resolve(root,'public/_headers'),'utf8');
    for(const path of ['/','/index.html','/js/*','/css/*','/data/*']) assert.ok(headers.includes(`${path}\n  Cache-Control: public, max-age=0, must-revalidate`),path);
    assert.ok(headers.includes('/releases/*\n  Cache-Control: public, max-age=31536000, immutable'));
  } finally {await rm(temp,{recursive:true,force:true});}
});
