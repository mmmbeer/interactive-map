import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { BinaryReader, unpack } from '../public/js/world-maps/binary.js';
import { archiveHeader, readDirectory, directoryEntry, tileId, MapArchive } from '../public/js/world-maps/pmtiles.js';
import { decodeTile, geometryPaths } from '../public/js/world-maps/mvt.js';
import { unionTileRings } from '../public/js/world-maps/tile-seams.js';
import { PreparedGeometry } from '../public/js/world-maps/prepared-geometry.js';
import { selectedTiles, fetchPreparedArea } from '../public/js/world-maps/prepared.js';
import { readRange } from '../public/js/world-maps/range.js';
import { convertArea } from '../public/js/world-maps/model.js';
import { ringArea, unproject, project, imageProjection } from '../public/js/world-maps/geo.js';
import { polygons } from '../public/js/world-maps/osm.js';
import { contains } from '../public/js/geometry.js';
const bounded=(name,fn)=>test(name,{timeout:3000},fn);
const uint=n=>{n=BigInt(n);const b=[];do{let byte=Number(n&127n);n>>=7n;if(n)byte|=128;b.push(byte);}while(n);return b;};
const packed=(field,bytes)=>[...uint(field*8+2),...uint(bytes.length),...bytes];
const str=(field,s)=>packed(field,new TextEncoder().encode(s));
const value=(field,n)=>[...uint(field*8),...uint(n)];
const ring=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]];
function commands(rings){const result=[];let x=0,y=0;const zz=n=>n<0?-n*2-1:n*2;for(const r of rings){const pts=r.slice(0,-1);result.push(9,zz(pts[0][0]-x),zz(pts[0][1]-y));[x,y]=pts[0];result.push((pts.length-1)*8+2);for(const p of pts.slice(1)){result.push(zz(p[0]-x),zz(p[1]-y));[x,y]=p;}result.push(15);}return result;}
function vectorTile(id=77n,rings=[ring(100,100,100,100)]) {
  const feature=[...value(1,id),...packed(2,[0,0]),...value(3,3),...packed(4,commands(rings).flatMap(uint))];
  const layer=[...packed(2,feature),...str(1,'buildings'),...str(3,'kind'),...packed(4,str(1,'building')),...value(5,4096),...value(15,2)];
  return new Uint8Array(packed(3,layer));
}
const bounds={west:.001,south:.001,east:.002,north:.002};
function archiveFixture(tiles=selectedTiles(bounds),compressed=false) {
  const payloads=tiles.map((_,i)=>compressed?gzipSync(vectorTile(BigInt(i+1),[ring(400,3400,100,100)])):vectorTile(BigInt(i+1),[ring(400,3400,100,100)]));
  const entries=tiles.map((t,i)=>({id:tileId(t.z,t.x,t.y),payload:payloads[i]})).sort((a,b)=>a.id-b.id);
  let previous=0,offset=0;const ids=[],runs=[],lengths=[],offsets=[];
  for(const e of entries){ids.push(...uint(e.id-previous));previous=e.id;runs.push(1);lengths.push(...uint(e.payload.length));offsets.push(...uint(offset+1));e.offset=offset;offset+=e.payload.length;}
  let directory=new Uint8Array([...uint(entries.length),...ids,...runs,...lengths,...offsets]);if(compressed)directory=gzipSync(directory);
  const bytes=new Uint8Array(16384+offset),view=new DataView(bytes.buffer);bytes.set(new TextEncoder().encode('PMTiles'));bytes[7]=3;
  for(const [at,n] of [[8,127],[16,directory.length],[24,127+directory.length],[32,0],[40,16384],[48,0],[56,16384],[64,offset]])view.setBigUint64(at,BigInt(n),true);
  bytes[97]=compressed?2:1;bytes[98]=compressed?2:1;bytes[99]=1;bytes[100]=0;bytes[101]=15;bytes.set(directory,127);
  for(const e of entries)bytes.set(e.payload,16384+e.offset);
  const fetcher=async(_url,options)=>{const [,a,b]=options.headers.Range.match(/bytes=(\d+)-(\d+)/),start=Number(a),end=Number(b);assert.ok(end<bytes.length);return new Response(bytes.slice(start,end+1),{status:206,headers:{'content-range':`bytes ${start}-${end}/${bytes.length}`}});};
  return {bytes,fetcher,payloads};
}

bounded('PMTiles Hilbert addressing matches the published specification',()=>{
  assert.equal(tileId(0,0,0),0);assert.deepEqual([[0,0],[0,1],[1,1],[1,0]].map(([x,y])=>tileId(1,x,y)),[1,2,3,4]);
  assert.equal(tileId(12,3423,1763),19078479);assert.throws(()=>tileId(27,0,0),/Invalid/);
});
bounded('directory delta IDs, contiguous offsets, run lengths and leaf pointers decode correctly',()=>{
  const bytes=new Uint8Array([3,5,37,27,3,0,1,42,12,4,10,0,101]);
  const d=readDirectory(bytes);assert.deepEqual(d,[{id:5,run:3,length:42,offset:9},{id:42,run:0,length:12,offset:51},{id:69,run:1,length:4,offset:100}]);
  assert.equal(directoryEntry(d,6),d[0]);assert.equal(directoryEntry(d,8),null);assert.equal(directoryEntry(d,65),d[1]);assert.equal(directoryEntry(d,69),d[2]);
});
bounded('vector decoding preserves 64-bit identifiers, rings and dictionary properties',()=>{
  const outer=ring(100,100,300,300),hole=[...ring(200,200,100,100)].reverse();
  const [f]=decodeTile(vectorTile(9007199254740993n,[outer,hole]));
  assert.equal(f.id,'9007199254740993');assert.equal(f.layer,'buildings');assert.equal(f.properties.kind,'building');assert.equal(f.type,3);assert.deepEqual(f.paths,[outer,hole]);
  assert.throws(()=>geometryPaths([9,2],2),/Truncated/);assert.throws(()=>geometryPaths([8],2),/Unsupported/);assert.throws(()=>new BinaryReader(new Uint8Array([128])).uint(),/truncated/);
});
bounded('gzip archives and raw archives locate and decode their actual tile payload',async()=>{
  for(const compressed of [false,true]) {
    const {fetcher}=archiveFixture(undefined,compressed),archive=await new MapArchive(`https://fixture-${compressed}.invalid/world.pmtiles`,{fetcher}).open();
    const t=selectedTiles(bounds)[0],bytes=await archive.tile(t.z,t.x,t.y);assert.equal(decodeTile(bytes)[0].properties.kind,'building');
    assert.equal(await archive.tile(15,0,0),null);
  }
  assert.deepEqual(await unpack(gzipSync(new Uint8Array([1,2,3])),2),new Uint8Array([1,2,3]));
  assert.throws(()=>archiveHeader(new Uint8Array(127)),/Unsupported/);
});
bounded('tile seams cancel a long edge against subdivided neighboring edges',()=>{
  const rings=[ring(4000,100,96,200),ring(4096,100,104,100),ring(4096,200,104,100)];
  const result=unionTileRings(rings);assert.equal(result.length,1);assert.equal(ringArea(result[0]),40000);
});
bounded('polygon union preserves holes, disconnected buildings and corner contacts',()=>{
  const outer=ring(100,100,400,400),hole=[...ring(200,200,100,100)].reverse(),separate=ring(600,600,100,100);
  const result=unionTileRings([outer,hole,separate]);assert.equal(result.length,3);assert.deepEqual(result.map(r=>ringArea(r)).sort((a,b)=>a-b),[-10000,10000,160000]);
  assert.equal(unionTileRings([ring(0,0,10,10),ring(10,10,10,10)]).length,2);
});
bounded('a building and courtyard crossing two tiles become one selectable building',()=>{
  const g=new PreparedGeometry(15),outer=ring(4000,100,200,200),hole=[...ring(4080,150,40,100)].reverse();
  for(const x of [0,1])g.add([{id:'77',type:3,extent:4096,layer:'buildings',properties:{kind:'building'},paths:[outer,hole].map(r=>r.map(([a,b])=>[a-x*4096,b]))}],16384+x,16384);
  const elements=g.finish();assert.equal(elements.length,1);const p=polygons(elements[0]);assert.equal(p.length,1);assert.equal(p[0].holes.length,1);
  const n=32768,sw=unproject((16384+3990/4096)/n,(16384+310/4096)/n),ne=unproject((16384+4210/4096)/n,(16384+90/4096)/n);
  const b={west:sw[0],south:sw[1],east:ne[0],north:ne[1]},map=convertArea({elements},{bounds:b,width:4096,height:4096,id:'local-seam-test',name:'Seam test'}).map;
  const inside=(x,y)=>{const point=unproject((16384+x/4096)/n,(16384+y/4096)/n);return imageProjection(b,4096,4096)(...point);};
  assert.ok(contains(map.locations[0],...inside(4050,200)));assert.ok(contains(map.locations[0],...inside(4150,200)));assert.ok(!contains(map.locations[0],...inside(4096,200)));
});
bounded('range downloads reject a whole archive response before reading any body',async()=>{
  let read=false;
  await assert.rejects(readRange('https://no-ranges.invalid/map',0,16384,{fetcher:async()=>({status:200,arrayBuffer:async()=>{read=true;return new ArrayBuffer(1);}})}),/partial download is required/);
  assert.equal(read,false);
  await assert.rejects(readRange('https://wrong-range.invalid/map',0,10,{fetcher:async()=>new Response(new Uint8Array(10),{status:206,headers:{'content-range':'bytes 10-19/100'}})}),/wrong byte range/);
});
bounded('range requests settle stalled transports, honor cancellation and cache only complete bytes',async()=>{
  await assert.rejects(readRange('https://stalled-range.invalid/map',0,10,{timeoutMs:10,fetcher:()=>new Promise(()=>{})}),/timed out/);
  const c=new AbortController(),pending=readRange('https://cancel-range.invalid/map',0,10,{signal:c.signal,fetcher:()=>new Promise(()=>{})});c.abort();await assert.rejects(pending,{name:'AbortError'});
  let calls=0;const options={fetcher:async()=>{calls++;return new Response(new Uint8Array([1,2,3]),{status:206});}};
  assert.deepEqual(await readRange('https://cached-range.invalid/map',10,3,options),new Uint8Array([1,2,3]));await readRange('https://cached-range.invalid/map',10,3,options);assert.equal(calls,1);
});
bounded('a prepared import fetches only a cutout and produces a valid atlas model',async()=>{
  const {fetcher}=archiveFixture(),progress=[];
  const data=await fetchPreparedArea(bounds,undefined,{url:'https://complete-cutout.invalid/world.pmtiles',fetcher,onProgress:p=>progress.push(p)});
  assert.equal(data.elements.length,1);assert.ok(progress.some(p=>p.completed===p.total));assert.equal(data.preparedSource.zoom,15);
  const {map}=convertArea(data,{bounds,width:4096,height:4096,id:'local-prepared-test',name:'Prepared test'});assert.equal(map.locations.length,1);assert.ok(map.worldImport.preparedSource);
  const cancelled=new AbortController();cancelled.abort();await assert.rejects(fetchPreparedArea(bounds,cancelled.signal),{name:'AbortError'});
});
bounded('tile selection stays at building detail and rejects unbounded region requests',()=>{
  const tiles=selectedTiles(bounds);assert.equal(tiles.length,1);assert.equal(tiles[0].z,15);
  assert.throws(()=>selectedTiles({west:-180,south:-80,east:180,north:80}),/Zoom in/);
  const t=tiles[0],[x,y]=project(.0015,.0015);assert.equal(t.x,Math.floor(x*32768));assert.equal(t.y,Math.floor(y*32768));
});
bounded('prepared cutouts cap concurrency at four and never accept a partial set of tiles',async()=>{
  const n=32768,sw=unproject(16384.05/n,16386.95/n),ne=unproject(16386.95/n,16384.05/n),b={west:sw[0],south:sw[1],east:ne[0],north:ne[1]};
  const tiles=selectedTiles(b),fixture=archiveFixture(tiles);assert.equal(tiles.length,9);
  let active=0,maximum=0;
  const fetcher=async(url,options)=>{active++;maximum=Math.max(maximum,active);try{await new Promise(resolve=>setTimeout(resolve,5));return await fixture.fetcher(url,options);}finally{active--;}};
  const result=await fetchPreparedArea(b,undefined,{url:'https://concurrency.invalid/world.pmtiles',fetcher});assert.equal(result.elements.length,9);assert.ok(maximum>1&&maximum<=4);
  let failed=false;
  await assert.rejects(fetchPreparedArea(b,undefined,{url:'https://partial-cutout.invalid/world.pmtiles',fetcher:async(url,options)=>{
    if(options.headers.Range!=='bytes=0-16383'&&!failed){failed=true;return new Response('',{status:503});}return fixture.fetcher(url,options);
  }}),/503/);
  const recovered=await fetchPreparedArea(b,undefined,{url:'https://partial-cutout.invalid/world.pmtiles',fetcher:fixture.fetcher});assert.equal(recovered.elements.length,9);
});
