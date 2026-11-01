// Bounded protobuf/PMTiles primitives. No executable content is read from map data.
export class BinaryReader {
  constructor(bytes){this.bytes=bytes;this.pos=0;this.view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);}
  need(n){if(!Number.isSafeInteger(n)||n<0||this.pos+n>this.bytes.length)throw new Error('The prepared map data is truncated.');}
  uint(){let n=0,m=1;for(let i=0;i<8;i++){this.need(1);const b=this.bytes[this.pos++];n+=(b&127)*m;if(!(b&128)){if(!Number.isSafeInteger(n))throw new Error('Map integer exceeds the supported range.');return n;}m*=128;}throw new Error('Invalid map integer.');}
  big(){let n=0n;for(let i=0;i<10;i++){this.need(1);const b=this.bytes[this.pos++];n|=BigInt(b&127)<<BigInt(i*7);if(!(b&128))return n;}throw new Error('Invalid map identifier.');}
  block(){const n=this.uint();this.need(n);const data=this.bytes.subarray(this.pos,this.pos+n);this.pos+=n;return data;}
  text(){return new TextDecoder().decode(this.block());}
  float(size){this.need(size);const n=size===4?this.view.getFloat32(this.pos,true):this.view.getFloat64(this.pos,true);this.pos+=size;return n;}
  skip(wire){if(wire===0)this.big();else if(wire===2)this.block();else if(wire===1||wire===5){const n=wire===1?8:4;this.need(n);this.pos+=n;}else throw new Error('Unsupported map field encoding.');}
}
export async function unpack(bytes,compression,signal,maxBytes=8*1024*1024) {
  signal?.throwIfAborted();
  if(compression===1)return bytes;
  if(compression!==2||!globalThis.DecompressionStream)throw new Error('This browser cannot decompress the prepared map data. Try Live map data.');
  const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader(),parts=[];let length=0;
  const abort=()=>reader.cancel().catch(()=>{});signal?.addEventListener('abort',abort,{once:true});
  try {
    while(true){const {value,done}=await reader.read();signal?.throwIfAborted();if(done)break;length+=value.length;if(length>maxBytes){abort();throw new Error('The prepared map tile is too large. Select a smaller area.');}parts.push(value);}
  }finally{signal?.removeEventListener('abort',abort);reader.releaseLock();}
  const result=new Uint8Array(length);let pos=0;for(const part of parts){result.set(part,pos);pos+=part.length;}return result;
}
