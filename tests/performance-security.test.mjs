import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {validateMap} from '../public/js/map-contract.js';
import {validateMapLimits} from '../public/js/map-limits.js';
import {validateGeography} from '../public/js/generation/geography-validation.js';
import {buildSpatialIndex,hitTest} from '../public/js/spatial.js';
import {localIndexes} from '../public/js/local-maps/store.js';
import {overlaySize,prepareOverlay,MAX_OVERLAY_PIXELS} from '../public/js/map-canvas.js';
import {MapStage} from '../public/js/map-stage.js';
import {WorldView} from '../public/js/world-maps/world-view.js';
import {DirectorySearch} from '../public/js/directory-search.js';
import {Worker} from 'node:worker_threads';
import {once} from 'node:events';
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
test('overlay stores have a fixed budget while drawing in original map coordinates',()=>{
  for(const [width,height] of [[948,1659],[3548,1774],[8192,2929],[1,8192]]) {
    const size=overlaySize(width,height);assert.ok(size.width*size.height<=MAX_OVERLAY_PIXELS);
    assert.ok(size.width<=4096&&size.height<=4096);
    let transform;const ctx={setTransform(...args){transform=args;}},canvas={getContext:()=>ctx};
    assert.equal(prepareOverlay(canvas,width,height),ctx);
    assert.equal(transform[0]*width,canvas.width);assert.equal(transform[3]*height,canvas.height);
  }
});
test('pointer bursts produce one draw and queued rendering stops when destroyed',()=>{
  const oldRequest=globalThis.requestAnimationFrame,oldCancel=globalThis.cancelAnimationFrame;
  let scheduled=0,cancelled,callback;globalThis.requestAnimationFrame=fn=>{scheduled++;callback=fn;return 42;};globalThis.cancelAnimationFrame=id=>{cancelled=id;};
  try {
    const draws=[],stage=Object.assign(Object.create(MapStage.prototype),{w:100,constrain(){},draw(animate){draws.push([this.tx,animate]);}});
    for(let i=0;i<20;i++){stage.tx=i;stage.render(i===3);}
    assert.equal(scheduled,1);callback();assert.deepEqual(draws,[[19,true]]);
    stage.render();const canvases=Array.from({length:4},()=>({width:100,height:100}));
    [stage.canvas,stage.baseCanvas]=canvases;stage.streetLayer={canvas:canvases[2]};stage.districtLayer={canvas:canvases[3]};
    stage.resizeObserver={disconnect(){}};stage.callbacks={hover(){}};stage.destroy();
    assert.equal(cancelled,42);assert.ok(canvases.every(c=>c.width===0&&c.height===0));
    stage.render();assert.equal(scheduled,2);
  } finally {globalThis.requestAnimationFrame=oldRequest;globalThis.cancelAnimationFrame=oldCancel;}
});
test('unchanged hover does not clear a map-sized canvas repeatedly',()=>{
  let clears=0;const stage=Object.assign(Object.create(MapStage.prototype),{scale:1,data:{width:8000,height:3000},pinEls:[],context:{clearRect(){clears++;}}});
  for(let i=0;i<100;i++)stage.highlight(null);assert.equal(clears,1);
  stage.scale=2;stage.highlight(null);assert.equal(clears,2);
});
test('region navigation coalesces tile and wizard updates into a display frame',()=>{
  const old=globalThis.requestAnimationFrame;let callback,calls=0,renders=0;
  globalThis.requestAnimationFrame=fn=>{calls++;callback=fn;return 1;};
  try {
    const world=Object.assign(Object.create(WorldView.prototype),{render(){renders++;}});
    for(let i=0;i<100;i++)world.draw();assert.equal(calls,1);callback();assert.equal(renders,1);
    world.destroyed=true;world.draw();assert.equal(calls,1);
  } finally {globalThis.requestAnimationFrame=old;}
});
test('directory workers reuse a source snapshot, discard stale results and stop on navigation',async()=>{
  const controller=new AbortController(),messages=[];let terminated=false;
  const worker={postMessage(data){messages.push(data);},terminate(){terminated=true;}};
  const directory=new DirectorySearch(fixture(),controller.signal,{createWorker:()=>worker});
  const old=directory.query({query:'old'}),next=directory.query({query:'next'});
  assert.equal(await old,null);assert.equal(messages.filter(m=>m.map).length,1);
  worker.onmessage({data:{id:messages[0].id,ids:['stale']}});
  worker.onmessage({data:{id:messages.at(-1).id,ids:['home']}});
  assert.deepEqual(await next,new Set(['home']));
  const cancelled=directory.query({query:'cancel'});controller.abort();assert.equal(await cancelled,null);assert.equal(terminated,true);
  assert.throws(()=>directory.query({query:'late'}),{name:'AbortError'});
});
test('the search worker matches full story text and metadata filters',async()=>{
  const worker=new Worker(new URL('./fixtures/directory-search-thread.mjs',import.meta.url));
  try {
    const map=fixture();map.locations.push({...map.locations[0],id:'shop',category:'shop',description:'Hidden moonstonecipher',integrations:{quests:{enabled:true}}});
    let response=once(worker,'message');worker.postMessage({id:1,map,filters:{query:'moonstonecipher'}});
    assert.deepEqual((await response)[0],{id:1,ids:['shop']});
    response=once(worker,'message');worker.postMessage({id:2,filters:{query:'quest board',category:'home'}});
    assert.deepEqual((await response)[0],{id:2,ids:[]});
    response=once(worker,'message');worker.postMessage({id:3,filters:{query:'quest board'}});
    assert.deepEqual((await response)[0],{id:3,ids:['shop']});
  } finally {await worker.terminate();}
});
test('the initial module graph excludes the optional procedural engines',async()=>{
  const seen=new Set();
  async function visit(path) {
    if(seen.has(path))return;seen.add(path);
    const code=await readFile(path,'utf8');
    for(const match of code.matchAll(/(?:from\s*|import\s*)['"]([^'"]+\.js)['"]/g))await visit(resolve(dirname(path),match[1]));
  }
  await visit(new URL('../public/js/app.js',import.meta.url).pathname);
  assert.ok(![...seen].some(path=>path.includes('/vendor/')));
  const library=await readFile(new URL('../public/js/library.js',import.meta.url),'utf8');
  assert.match(library,/import\('\.\/world-maps\/dialog.js'\)/);
});
