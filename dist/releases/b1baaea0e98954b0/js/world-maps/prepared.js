import { checkArea, checkRegion } from './geo.js';
import { regionPlan, tileCoverage, sourceAllowed } from './region-scale.js';
import { MapArchive } from './pmtiles.js';
import { decodeTile } from './mvt.js';
import { PreparedGeometry } from './prepared-geometry.js';
// This fixed archive is published for spatial cutouts. Only requested byte ranges are read.
export const PREPARED_ARCHIVE='https://data.source.coop/protomaps/openstreetmap/v4.pmtiles';
let cache;
export function selectedTiles(bounds,z=15,{regional=false}={}) {
  (regional?checkRegion:checkArea)(bounds);
  const box=tileCoverage(bounds,z),tiles=[];
  if(box.count>96)throw new Error('This selection crosses too many map tiles. Choose a smaller area or less source detail.');
  for(let x=box.left;x<=box.right;x++)for(let y=box.top;y<=box.bottom;y++)tiles.push({z,x,y});
  return tiles;
}
export async function fetchPreparedArea(bounds,signal,{onProgress=()=>{},fetcher=globalThis.fetch,url=PREPARED_ARCHIVE,regional=false}={}) {
  signal?.throwIfAborted();const plan=regional?regionPlan(bounds):null,z=plan?.zoom??15,tiles=selectedTiles(bounds,z,{regional}),key=JSON.stringify({bounds,url,z,regional});if(cache?.key===key)return cache.data;
  const controller=new AbortController(),abort=()=>controller.abort(signal.reason);signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>controller.abort(new Error('The prepared map download took too long. Try again.')),60000);
  let bytes=0,decodedBytes=0,completed=0,next=0;
  const progress=stage=>onProgress({stage,bytes,completed,total:tiles.length});
  const options={signal:controller.signal,fetcher,onBytes:count=>{bytes+=count;if(bytes>20*1024*1024){controller.abort(new Error('The prepared map cutout is too large. Choose a smaller area.'));return;}progress('prepared');}};
  try {
    progress('prepared');const archive=await new MapArchive(url,options).open(),geometry=new PreparedGeometry(z,{allowTags:tags=>!plan||sourceAllowed(tags,plan)}),results=new Array(tiles.length);
    async function worker(){while(next<tiles.length){controller.signal.throwIfAborted();const i=next++,tile=tiles[i],data=await archive.tile(tile.z,tile.x,tile.y);controller.signal.throwIfAborted();decodedBytes+=data?.length||0;if(decodedBytes>48*1024*1024)throw new Error('This selection contains too much map detail. Choose a smaller area.');results[i]=data?decodeTile(data):[];completed++;progress('prepared');}}
    await Promise.all(Array.from({length:Math.min(4,tiles.length)},()=>worker()));
    for(let i=0;i<tiles.length;i++){controller.signal.throwIfAborted();geometry.add(results[i],tiles[i].x,tiles[i].y);}
    const data={elements:geometry.finish(),preparedSource:{provider:'Protomaps',url,schema:'protomaps-v4',zoom:z,...(plan?{regionLevel:plan.level}:{}),snapshot:'2026-03-31',tileCount:tiles.length}};
    controller.signal.throwIfAborted();cache={key,data};return data;
  }finally{controller.abort();clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
