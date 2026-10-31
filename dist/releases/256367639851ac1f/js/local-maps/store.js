import { validateMap } from '../map-contract.js';
import { buildSpatialIndex } from '../spatial.js';
const DB='wandering-atlas-local-maps',VERSION=1;
let opening;
function database() {
  if(!globalThis.indexedDB)return Promise.reject(new Error('Local maps need browser database storage. Enable site storage and try again.'));
  return opening ||= new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB,VERSION);
    request.onupgradeneeded=()=>{const store=request.result.createObjectStore('maps',{keyPath:'id'});store.createIndex('updatedAt','updatedAt');};
    request.onerror=()=>{opening=null;reject(new Error('Could not open local map storage.'));};
    request.onblocked=()=>{opening=null;reject(new Error('Close other atlas tabs and try again.'));};
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();opening=null;};resolve(db);};
  });
}
async function transaction(mode,action) {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('maps',mode),request=action(tx.objectStore('maps'));
    tx.oncomplete=()=>resolve(request.result);
    tx.onerror=tx.onabort=()=>reject(new Error((tx.error||request.error)?.name==='ConstraintError'?'This map already exists in this browser. Open the saved map, or export and delete it before restoring this backup.':(tx.error||request.error)?.name==='QuotaExceededError'?'Not enough browser storage. Export or delete another local map and retry.':'Could not save or read the local map. Site storage may be unavailable or full.'));
  });
}
export function localIndexes(map) {
  const cellSize=Math.max(32,Math.ceil(Math.max(map.width,map.height)/64)),spatial=buildSpatialIndex(map.locations,cellSize);
  const categories=Object.create(null),districts=Object.create(null),byId=Object.create(null);
  map.locations.forEach((p,i)=>{
    byId[p.id]=i;(categories[p.category] ||= []).push(p.id);(districts[p.district] ||= []).push(p.id);
  });
  return {version:1,cellSize,cells:[...spatial.cells].map(([cell,places])=>[cell,places.map(p=>p.id)]),byId,categories,districts};
}
export async function saveLocalMap(map,image,thumbnail,initialMap=map,{create=false}={}) {
  validateMap(map);
  if(!map.id.startsWith('local-'))throw new Error('Local map ids must start with local-.');
  if(!(image instanceof Blob) || !image.size || !(thumbnail instanceof Blob))throw new Error('The map image is missing.');
  const record={id:map.id,map:structuredClone(map),image,thumbnail,initialMap:structuredClone(initialMap),indexes:localIndexes(map),updatedAt:Date.now()};
  await transaction('readwrite',store=>create ? store.add(record) : store.put(record));return record;
}
export const readLocalMap=id=>transaction('readonly',store=>store.get(id));
export const deleteLocalMap=id=>transaction('readwrite',store=>store.delete(id));
export async function listLocalMaps() {
  // Cursor through metadata to avoid retaining all full-resolution map Blobs in the collection.
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('maps'),request=tx.objectStore('maps').openCursor(),entries=[];
    request.onsuccess=()=>{
      const cursor=request.result;if(!cursor)return;
      const {map,thumbnail,updatedAt}=cursor.value;
      entries.push({id:map.id,name:map.name,theme:'On this device',region:map.region,subtitle:map.subtitle,locationCount:map.locations.length,tags:map.tags||[],local:true,thumbnailBlob:thumbnail,updatedAt});cursor.continue();
    };
    tx.oncomplete=()=>resolve(entries.sort((a,b)=>b.updatedAt-a.updatedAt));tx.onerror=()=>reject(new Error('Could not read your local maps.'));
  });
}
export function hydrateLocalMap(map,record,urls) {
  const image=URL.createObjectURL(record.image),thumbnail=URL.createObjectURL(record.thumbnail);urls.push(image,thumbnail);
  return {...map,image,thumbnail,localIndexes:record.indexes};
}
