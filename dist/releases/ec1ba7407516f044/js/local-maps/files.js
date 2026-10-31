import { normalizeSettings } from '../generation/settlement-settings.js';
import { validateMap } from '../map-contract.js';
export const MAX_FILE=40*1024*1024,MAX_PIXELS=24000000;
export async function decodeImage(blob) {
  if(blob.size>MAX_FILE)throw new Error('Choose an image smaller than 40 MB.');
  if(!['image/png','image/jpeg','image/webp'].includes(blob.type))throw new Error('Choose a PNG, JPEG or WebP image.');
  const image=await createImageBitmap(blob);
  if(image.width*image.height>MAX_PIXELS || image.width>8192 || image.height>8192) {
    image.close();throw new Error('Choose a map up to 24 million pixels with each side at most 8192 pixels.');
  }
  return image;
}
export async function prepareImage(blob) {
  const bitmap=await decodeImage(blob),width=bitmap.width,height=bitmap.height;
  const scale=Math.min(1,1200/Math.max(width,height)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  const thumb=document.createElement('canvas');thumb.width=Math.max(1,Math.round(width*Math.min(1,360/width)));thumb.height=Math.max(1,Math.round(height*thumb.width/width));
  thumb.getContext('2d').drawImage(bitmap,0,0,thumb.width,thumb.height);bitmap.close();
  const thumbnail=await new Promise(resolve=>thumb.toBlob(resolve,'image/webp',0.8));
  if(!thumbnail)throw new Error('Could not prepare the map thumbnail.');
  return {width,height,w:canvas.width,h:canvas.height,rgba,thumbnail,canvas};
}
function dataURL(blob) {return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not read the backup image.'));reader.readAsDataURL(blob);});}
export async function exportBackup(record,settings) {
  const backup={format:'wandering-atlas-local',version:1,map:record.map,...(settings?{settings}:{}),image:await dataURL(record.image),thumbnail:await dataURL(record.thumbnail)};
  const url=URL.createObjectURL(new Blob([JSON.stringify(backup)],{type:'application/json'})),a=document.createElement('a');
  a.href=url;a.download=`${record.map.id}.atlas.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function importBackup(file) {
  if(file.size>60*1024*1024)throw new Error('The backup must be smaller than 60 MB.');
  const data=JSON.parse(await file.text());
  if(data.format!=='wandering-atlas-local' || data.version!==1)throw new Error('Choose an atlas backup exported by this app.');
  validateMap(data.map);
  const blobFromURL=value=>{
    if(typeof value!=='string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value))throw new Error('The backup contains an unsupported image.');
    const [head,body]=value.split(','),bytes=Uint8Array.from(atob(body),c=>c.charCodeAt(0));
    return new Blob([bytes],{type:head.slice(5,head.indexOf(';'))});
  };
  const image=blobFromURL(data.image),bitmap=await decodeImage(image);
  if(bitmap.width!==data.map.width || bitmap.height!==data.map.height){bitmap.close();throw new Error('Backup image dimensions do not match its geometry.');}bitmap.close();
  // Keep map identity because it is part of every deterministic name and story.
  if(!data.map.id.startsWith('local-'))throw new Error('The backup must contain a local map.');
  const map=data.map;
  const prepared=await prepareImage(image);return {map,image,thumbnail:prepared.thumbnail,settings:data.settings ? normalizeSettings(map,data.settings) : null};
}
