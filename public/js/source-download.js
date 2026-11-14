import { responseJSON } from './response-json.js';
const MAX_BYTES=64*1024*1024,PART_BYTES=512*1024;
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
export function validateSourceManifest(m) {
  if(m?.version!==1||m.filename!=='procedural-source.tar.gz'||!Number.isSafeInteger(m.bytes)||m.bytes<=0||m.bytes>MAX_BYTES||!/^[a-f0-9]{64}$/.test(m.sha256)||!Array.isArray(m.parts)||!m.parts.length||m.parts.length>128)throw new Error('Invalid source manifest.');
  const names=new Set();let bytes=0;
  for(const p of m.parts) {
    if(!/^part-\d{4}-[a-f0-9]{16}\.bin$/.test(p.name)||!Number.isSafeInteger(p.bytes)||p.bytes<=0||p.bytes>PART_BYTES||!/^[a-f0-9]{64}$/.test(p.sha256)||names.has(p.name))throw new Error('Invalid source part.');
    names.add(p.name);bytes+=p.bytes;
  }
  if(bytes!==m.bytes)throw new Error('Invalid source archive size.');
  return m;
}
export async function assembleSource(manifest,loadPart) {
  validateSourceManifest(manifest);
  const archive=new Uint8Array(manifest.bytes);let offset=0;
  for(const p of manifest.parts) {
    const data=await loadPart(p);
    if(data.byteLength!==p.bytes||await digest(data)!==p.sha256)throw new Error('Source checksum failed. Reload this page and retry.');
    archive.set(data,offset);offset+=data.byteLength;
  }
  if(await digest(archive)!==manifest.sha256)throw new Error('Source archive checksum failed.');
  return archive;
}
async function partBytes(response,maxBytes) {
  if(!response.ok)throw new Error('Could not download source. Reload this page and retry.');
  const reader=response.body.getReader(),chunks=[];let bytes=0;
  try {
    while(true) {
      const next=await reader.read();if(next.done)break;
      bytes+=next.value.byteLength;if(bytes>maxBytes)throw new Error('Source part exceeds its declared size.');
      chunks.push(next.value);
    }
  } finally {await reader.cancel().catch(()=>{});reader.releaseLock();}
  const data=new Uint8Array(bytes);let offset=0;
  for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;}
  return data;
}
if(typeof document!=='undefined'&&document.querySelector('#download-source')) {
  const button=document.querySelector('#download-source'),status=document.querySelector('#source-status');
  button.addEventListener('click',async()=>{
    button.disabled=true;status.textContent='Reading source manifest…';
    try {
      const base=new URL('procedural-source/',location.href),response=await fetch(new URL('manifest.json',base),{cache:'no-store'});
      if(!response.ok)throw new Error('Could not read source manifest. Retry later.');
      const manifest=validateSourceManifest(await responseJSON(response,{maxBytes:65536}));let count=0;
      const archive=await assembleSource(manifest,async p=>{
        status.textContent=`Downloading and verifying part ${++count} of ${manifest.parts.length}…`;
        return partBytes(await fetch(new URL(p.name,base),{cache:'no-store'}),p.bytes);
      });
      const url=URL.createObjectURL(new Blob([archive],{type:'application/gzip'})),link=document.createElement('a');
      link.href=url;link.download=manifest.filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
      status.textContent='Complete source archive downloaded. All SHA-256 checks passed.';
    } catch(error) {status.textContent=error.message;}
    finally {button.disabled=false;}
  });
}
