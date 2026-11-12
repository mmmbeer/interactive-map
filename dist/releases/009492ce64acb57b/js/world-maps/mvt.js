// Mapbox Vector Tile specification 2.1: https://github.com/mapbox/vector-tile-spec
import { BinaryReader } from './binary.js';
const wanted=new Set(['buildings','roads','water','landuse','natural','landcover','pois']);
function readValue(bytes) {
  const r=new BinaryReader(bytes);
  while(r.pos<bytes.length) {
    const tag=r.uint(),field=Math.floor(tag/8),wire=tag%8;
    if(field===1&&wire===2)return r.text();
    if(field===2&&wire===5)return r.float(4);
    if(field===3&&wire===1)return r.float(8);
    if([4,5,6,7].includes(field)&&wire===0){let n=r.big();if(field===7)return n!==0n;if(field===4)n=BigInt.asIntN(64,n);if(field===6)n=(n>>1n)^(-(n&1n));return n<=BigInt(Number.MAX_SAFE_INTEGER)&&n>=BigInt(Number.MIN_SAFE_INTEGER)?Number(n):String(n);}
    r.skip(wire);
  }return null;
}
function packed(bytes) {const r=new BinaryReader(bytes),values=[];while(r.pos<bytes.length)values.push(r.uint());return values;}
export function geometryPaths(commands,type) {
  const paths=[];let x=0,y=0,path=null,i=0;
  const signed=n=>n%2?-(n+1)/2:n/2;
  while(i<commands.length) {
    const command=commands[i++],id=command%8,count=Math.floor(command/8);
    if(!count||count>1000000)throw new Error('Invalid map geometry command.');
    if(id===7){if(type!==3||!path||count!==1)throw new Error('Invalid polygon closure.');path.push([...path[0]]);continue;}
    if(id!==1&&id!==2)throw new Error('Unsupported map geometry command.');
    for(let j=0;j<count;j++) {
      if(i+1>=commands.length)throw new Error('Truncated map geometry.');
      x+=signed(commands[i++]);y+=signed(commands[i++]);
      if(id===1){path=[];paths.push(path);}else if(!path)throw new Error('Map line has no start.');
      path.push([x,y]);
    }
  }
  if(type===3&&paths.some(p=>p.length<4||p[0][0]!==p.at(-1)[0]||p[0][1]!==p.at(-1)[1]))throw new Error('Prepared map polygon is not closed.');
  return paths;
}
function readFeature(bytes,keys,values,extent,layer) {
  const r=new BinaryReader(bytes);let id=null,type=0,tags=[],commands=[];
  while(r.pos<bytes.length) {
    const tag=r.uint(),field=Math.floor(tag/8),wire=tag%8;
    if(field===1&&wire===0)id=String(r.big());
    else if(field===2&&wire===2)for(const n of packed(r.block()))tags.push(n);
    else if(field===3&&wire===0)type=r.uint();
    else if(field===4&&wire===2)for(const n of packed(r.block()))commands.push(n);
    else r.skip(wire);
  }
  if(tags.length%2)throw new Error('Invalid prepared map properties.');
  const properties=Object.create(null);
  for(let i=0;i<tags.length;i+=2){if(tags[i]>=keys.length||tags[i+1]>=values.length)throw new Error('Invalid prepared map property reference.');properties[keys[tags[i]]]=values[tags[i+1]];}
  return {id,type,properties,extent,layer,paths:geometryPaths(commands,type)};
}
function readLayer(bytes) {
  const r=new BinaryReader(bytes),keys=[],values=[],features=[];let name='',extent=4096,version=1;
  while(r.pos<bytes.length) {
    const tag=r.uint(),field=Math.floor(tag/8),wire=tag%8;
    if(field===1&&wire===2)name=r.text();
    else if(field===2&&wire===2)features.push(r.block());
    else if(field===3&&wire===2)keys.push(r.text());
    else if(field===4&&wire===2)values.push(readValue(r.block()));
    else if(field===5&&wire===0)extent=r.uint();
    else if(field===15&&wire===0)version=r.uint();
    else r.skip(wire);
  }
  if(!wanted.has(name))return [];
  if(![1,2].includes(version)||!extent||extent>65536||features.length>50000)throw new Error('Unsupported prepared map layer.');
  return features.map(f=>readFeature(f,keys,values,extent,name));
}
export function decodeTile(bytes) {
  const r=new BinaryReader(bytes),features=[];
  while(r.pos<bytes.length){const tag=r.uint();if(Math.floor(tag/8)===3&&tag%8===2)for(const f of readLayer(r.block()))features.push(f);else r.skip(tag%8);}
  return features;
}
