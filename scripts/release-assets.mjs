import { createHash } from 'node:crypto';
import { readFile, readdir, cp, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
async function filesIn(root) {
  const entries=await readdir(root,{withFileTypes:true});
  return (await Promise.all(entries.map(e=>e.isDirectory() ? filesIn(resolve(root,e.name)) : resolve(root,e.name)))).flat();
}
export async function versionAssets(source,output) {
  const html=await readFile(resolve(source,'index.html'),'utf8');
  const files=(await Promise.all(['js','css'].map(folder=>filesIn(resolve(source,folder))))).flat().sort();
  const hash=createHash('sha256').update(html);
  for (const file of files) {
    const path=relative(source,file).replaceAll('\\','/'),data=await readFile(file);
    hash.update(JSON.stringify([path,data.length])).update(data);
  }
  const release=hash.digest('hex').slice(0,16),prefix=`releases/${release}`;
  await mkdir(resolve(output,prefix),{recursive:true});
  for (const folder of ['js','css']) await cp(resolve(source,folder),resolve(output,prefix,folder),{recursive:true});
  // All relative ES module imports stay inside the same release directory.
  // Keep the original paths as revalidated compatibility aliases for older pages.
  const versioned=html.replace(/\b(src|href)="((?:js|css)\/[^"?#]+)"/g,(_,attribute,path)=>`${attribute}="${prefix}/${path}"`);
  await writeFile(resolve(output,'index.html'),versioned);
  return release;
}
