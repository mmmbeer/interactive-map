// PMTiles v3 specification: https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md
import { BinaryReader, unpack } from './binary.js';
import { readRange } from './range.js';
export function tileId(z,x,y) {
  const n=2**z;if(!Number.isInteger(z)||z<0||z>26||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=n||y>=n)throw new Error('Invalid map tile coordinates.');
  let d=0;
  for(let s=n/2;s>=1;s/=2){const rx=(x&s)?1:0,ry=(y&s)?1:0;d+=s*s*((3*rx)^ry);if(!ry){if(rx){x=n-1-x;y=n-1-y;}[x,y]=[y,x];}}
  return (4**z-1)/3+d;
}
export function archiveHeader(bytes) {
  if(bytes.length<127||new TextDecoder().decode(bytes.subarray(0,7))!=='PMTiles'||bytes[7]!==3)throw new Error('Unsupported prepared map archive.');
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),u64=p=>{const n=Number(v.getBigUint64(p,true));if(!Number.isSafeInteger(n))throw new Error('Prepared map archive exceeds supported offsets.');return n;};
  const h={rootOffset:u64(8),rootLength:u64(16),metadataOffset:u64(24),metadataLength:u64(32),leafOffset:u64(40),leafLength:u64(48),tileOffset:u64(56),tileLength:u64(64),internal:bytes[97],compression:bytes[98],type:bytes[99],minZoom:bytes[100],maxZoom:bytes[101]};
  if(h.type!==1||h.maxZoom<15||h.rootOffset<127||h.rootOffset+h.rootLength>16384)throw new Error('Prepared map archive lacks detailed vector geometry.');
  return h;
}
export function readDirectory(bytes) {
  const r=new BinaryReader(bytes),n=r.uint();if(!n||n>200000)throw new Error('Invalid prepared map directory.');
  const entries=[];let id=0;
  for(let i=0;i<n;i++){id+=r.uint();entries.push({id});}
  for(const e of entries)e.run=r.uint();
  for(const e of entries){e.length=r.uint();if(!e.length)throw new Error('Empty prepared map directory entry.');}
  for(let i=0;i<n;i++){const offset=r.uint();entries[i].offset=offset===0&&i>0?entries[i-1].offset+entries[i-1].length:offset-1;if(entries[i].offset<0)throw new Error('Invalid prepared map offset.');}
  return entries;
}
export function directoryEntry(entries,id) {
  let lo=0,hi=entries.length-1,best=null;
  while(lo<=hi){const mid=Math.floor((lo+hi)/2),e=entries[mid];if(e.id<=id){best=e;lo=mid+1;}else hi=mid-1;}
  return best&&(!best.run||id<best.id+best.run)?best:null;
}
export class MapArchive {
  constructor(url,options={}){this.url=url;this.options=options;this.directories=new Map();this.inflight=new Map();}
  range(offset,length){const key=`${offset}:${length}`;if(!this.inflight.has(key)){const p=readRange(this.url,offset,length,this.options).finally(()=>this.inflight.delete(key));this.inflight.set(key,p);}return this.inflight.get(key);}
  async open(){const bytes=await this.range(0,16384);this.header=archiveHeader(bytes);const h=this.header;this.root=readDirectory(await unpack(bytes.subarray(h.rootOffset,h.rootOffset+h.rootLength),h.internal,this.options.signal));return this;}
  async tile(z,x,y) {
    const id=tileId(z,x,y),h=this.header;let entries=this.root;
    for(let depth=0;depth<4;depth++) {
      this.options.signal?.throwIfAborted();const e=directoryEntry(entries,id);if(!e)return null;
      if(e.run){if(e.offset+e.length>h.tileLength)throw new Error('Prepared tile is outside its archive.');return unpack(await this.range(h.tileOffset+e.offset,e.length),h.compression,this.options.signal);}
      if(e.offset+e.length>h.leafLength)throw new Error('Prepared directory is outside its archive.');
      const key=`${e.offset}:${e.length}`;
      if(!this.directories.has(key))this.directories.set(key,(async()=>readDirectory(await unpack(await this.range(h.leafOffset+e.offset,e.length),h.internal,this.options.signal)))());
      entries=await this.directories.get(key);
    }throw new Error('Prepared map directory is too deeply nested.');
  }
}
