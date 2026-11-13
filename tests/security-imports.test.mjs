import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateMap} from '../public/js/map-contract.js';
import {validateMapLimits} from '../public/js/map-limits.js';
import {validateGeography} from '../public/js/generation/geography-validation.js';
import {buildSpatialIndex,hitTest} from '../public/js/spatial.js';
import {localIndexes} from '../public/js/local-maps/store.js';
const fixture=()=>({id:'demo',name:'Demo',subtitle:'A city',theme:'City',region:'Coast',description:'Example',
  image:'assets/map.webp',thumbnail:'assets/thumb.webp',width:100,height:100,
  locations:[{id:'home',name:'Home',description:'Home',district:'Old Town',category:'home',x:50,y:50}]});

test('imports reject resource exhaustion before generation or spatial indexing',()=>{
  for(const dimensions of [[1e12,1e12],[8193,100],[8192,8192],[100.5,100]]) {
    const map=fixture();[map.width,map.height]=dimensions;assert.throws(()=>validateMap(map),/dimensions/);
  }
  const map=fixture();map.locations=new Array(30001).fill(map.locations[0]);assert.throws(()=>validateMap(map),/30000/);
  const nested=fixture();let cursor=nested;
  for(let i=0;i<40;i++){cursor.nested={};cursor=cursor.nested;}
  assert.throws(()=>validateMapLimits(nested),/nested/);
  const complex=fixture();complex.locations[0].shape={points:new Array(8193).fill([0,0])};
  assert.throws(()=>validateMapLimits(complex),/geometry/);
  const holes=fixture();holes.locations[0].shape={points:new Array(5000).fill([0,0]),holes:[new Array(5000).fill([1,1])]};
  assert.throws(()=>validateMapLimits(holes),/polygon holes/);
});
test('asset paths cannot hide executable schemes or cross-origin URLs behind whitespace and controls',()=>{
  for(const image of [' javascript:alert(1)','java\nscript:alert(1)','\t//evil.example/a','https://evil.example/a','../private','%2e%2e/private','assets\\map.webp']) {
    const map={...fixture(),image};assert.throws(()=>validateMap(map),/relative asset/);
  }
  assert.equal(validateMap(fixture()),1);
});
test('geographic chains are bounded in either traversal order',()=>{
  const locations=Array.from({length:40},(_,i)=>({id:`water-${i}`,category:'water',generation:{version:2},...(i?{context:{water:`water-${i-1}`}}:{})}));
  for(const list of [locations,[...locations].reverse()])assert.throws(()=>validateGeography({locations:list}),/deeply linked/);
});
test('large polygons use bounded spatial storage and retain hit testing and saved indexes',()=>{
  const sea={id:'sea',x:4000,y:4000,category:'water',district:'Coast',bounds:[0,0,8000,8000]};
  const home={id:'home',x:50,y:50,category:'home',district:'Coast',bounds:[45,45,10,10]};
  const places=[sea,home],index=buildSpatialIndex(places);
  assert.deepEqual(index.large,[sea]);assert.ok(index.cells.size<=4);
  assert.equal(hitTest(index,places,50,50),home);assert.equal(hitTest(index,places,7000,7000),sea);
  assert.equal(hitTest(index,places,7000,7000,1,p=>p.category==='home'),null);
  const saved=localIndexes({width:8000,height:8000,locations:places});assert.deepEqual(saved.large,['sea']);assert.equal(saved.version,2);
});