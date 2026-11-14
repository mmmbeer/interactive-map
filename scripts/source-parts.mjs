import { createHash } from 'node:crypto';
import { mkdir,readFile,writeFile,readdir,rm } from 'node:fs/promises';
import { resolve } from 'node:path';
export const SOURCE_PART_BYTES=512*1024;
const digest=data=>createHash('sha256').update(data).digest('hex');
const partName=/^part-\d{4}-[a-f0-9]{16}\.bin$/;
export async function readSourceParts(directory) {
  const manifest=JSON.parse(await readFile(resolve(directory,'manifest.json'),'utf8'));
  if(manifest.version!==1||!Array.isArray(manifest.parts)||manifest.parts.length>128)throw new Error('Invalid source manifest.');
  const parts=[];
  for(const p of manifest.parts) {
    if(!partName.test(p.name))throw new Error('Invalid source part name.');
    const data=await readFile(resolve(directory,p.name));
    if(data.length!==p.bytes||digest(data)!==p.sha256)throw new Error('Invalid source part checksum.');
    parts.push(data);
  }
  const archive=Buffer.concat(parts);
  if(archive.length!==manifest.bytes||digest(archive)!==manifest.sha256)throw new Error('Invalid source archive checksum.');
  return archive;
}
export async function writeSourceParts(directory,archive) {
  await mkdir(directory,{recursive:true});
  const manifest={version:1,filename:'procedural-source.tar.gz',bytes:archive.length,sha256:digest(archive),parts:[]};
  for(let start=0,index=1;start<archive.length;start+=SOURCE_PART_BYTES,index++) {
    const data=archive.subarray(start,start+SOURCE_PART_BYTES),sha256=digest(data);
    const name=`part-${String(index).padStart(4,'0')}-${sha256.slice(0,16)}.bin`;
    await writeFile(resolve(directory,name),data);
    manifest.parts.push({name,bytes:data.length,sha256});
  }
  await writeFile(resolve(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  const names=new Set(manifest.parts.map(p=>p.name));
  for(const name of await readdir(directory))if(partName.test(name)&&!names.has(name))await rm(resolve(directory,name));
}
