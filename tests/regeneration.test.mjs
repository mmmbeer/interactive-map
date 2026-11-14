import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker as NodeWorker } from 'node:worker_threads';
import { regenerateContent, saveRegeneration } from '../public/js/local-maps/regeneration.js';
import { regenerateLayout } from '../public/js/world-maps/regeneration.js';
import { regenerateInWorker } from '../public/js/world-maps/worker-client.js';
import { convertArea } from '../public/js/world-maps/model.js';
import { peninsulaSource, peninsulaOptions } from './fixtures/peninsula-village.mjs';
import { materializeMap } from '../public/js/generation/locations.js';
import { applySettings } from '../public/js/generation/settlement-settings.js';
import { validateMap } from '../public/js/map-contract.js';

const settings={ancestry:'original',seed:'regenerated-world'};
const model=()=>({id:'sample',schemaVersion:2,name:'Sample',subtitle:'Test',description:'Test',region:'Coast',theme:'Ink',image:'map.webp',thumbnail:'thumb.webp',width:100,height:100,
  generator:{version:2,seed:'original'},districts:[{id:'ward',name:'Ward'}],locations:[
    {id:'home',category:'home',type:'home',district:'ward',x:30,y:40},
    {id:'beacon',category:'landmark',type:'landmark',district:'ward',x:50,y:60,overrides:{name:'Old Beacon',description:'Authored history.'}}
  ]});
const names=map=>materializeMap(applySettings(map,map.settlementSettings||{ancestry:'original',seed:String(map.generator.seed)})).locations.map(p=>p.name);
const geometry=map=>map.locations.map(p=>[p.id,p.x,p.y,p.shape]);
let imported;
const importedMap=()=>imported ||= convertArea(peninsulaSource,{...peninsulaOptions,width:900,height:900,settlement:{type:'hamlet'}}).map;

test('content regeneration is repeatable and preserves compact inputs, geometry and authored text',()=>{
  const source=model(),before=structuredClone(source),next=regenerateContent(source,settings);
  validateMap(next);assert.deepEqual(source,before);assert.deepEqual(geometry(next),geometry(source));
  assert.deepEqual(next.locations,source.locations);
  assert.notDeepEqual(names(next),names(source));
  assert.deepEqual(names(regenerateContent(source,settings)),names(next));
  assert.equal(names(next)[1],'Old Beacon');
  assert.equal(next.locations[1].overrides.description,'Authored history.');
  assert.equal(next.locations[0].name,undefined);
  assert.throws(()=>regenerateContent(source,{...settings,seed:''}),/seed/);
});
test('regenerated published and local maps save as separate copies with unchanged generation identity',async()=>{
  const source=model(),next=regenerateContent(source,settings),before=structuredClone(source),calls=[];
  const image=new Blob(['image']),thumbnail=new Blob(['thumb']);
  const save=async(map,image,thumbnail,initialMap,options)=>{calls.push({map,image,thumbnail,initialMap,options});return {id:map.id,map};};
  const first=await saveRegeneration(next,source,settings,{files:{image,thumbnail},save});
  const second=await saveRegeneration(first.map,first.map,settings,{record:{image,thumbnail},save,fetchAsset:()=>assert.fail('Local copies reuse stored artwork')});
  assert.notEqual(first.id,source.id);assert.notEqual(second.id,first.id);
  assert.equal(first.map.generationId,source.id);assert.equal(second.map.generationId,source.id);
  assert.deepEqual(names(first.map),names(next));assert.deepEqual(source,before);
  for(const call of calls){assert.deepEqual(call.options,{create:true});assert.deepEqual(call.initialMap,call.map);assert.equal(call.image,image);}
});
test('asset errors and cancellation do not save a regeneration',async()=>{
  const source=model(),next=regenerateContent(source,settings),controller=new AbortController();let writes=0;
  const save=()=>{writes++;};
  await assert.rejects(saveRegeneration(next,source,settings,{save,fetchAsset:async()=>({ok:false})}),/copy the map image/);
  controller.abort();
  await assert.rejects(saveRegeneration(next,source,settings,{save,signal:controller.signal}),{name:'AbortError'});
  await assert.rejects(saveRegeneration(next,source,settings,{save,signal:new AbortController().signal,fetchAsset:async()=>{throw new Error('Offline');}}),/Offline/);
  assert.equal(writes,0);
});
test('layout regeneration upgrades the planner, retains source geometry and removes old generated features',()=>{
  const source=structuredClone(importedMap());source.worldImport.procedural.version=3;
  const before=structuredClone(source),next=regenerateLayout(source,settings).map;
  validateMap(next);assert.deepEqual(source,before);assert.equal(next.worldImport.procedural.version,4);
  const coast=source.locations.find(p=>p.worldStyle?.origin!=='generated');
  assert.deepEqual(next.locations.find(p=>p.id===coast.id).shape,coast.shape);
  assert.equal(next.measurement.metersPerPixel,source.measurement.metersPerPixel);
  assert.notDeepEqual(geometry(next),geometry(source));
  assert.equal(new Set(next.locations.map(p=>p.id)).size,next.locations.length);
  const again=regenerateLayout(next,settings).map;
  assert.deepEqual(geometry(again),geometry(next));
  assert.deepEqual(again.worldImport.procedural.decisions,next.worldImport.procedural.decisions);
  assert.throws(()=>regenerateLayout(model(),settings),/real-world import/);
});
test('retained mapped streets and buildings keep their IDs, shapes, overrides and references',()=>{
  const bounds={west:0,south:0,east:.004,north:.004},geometry=points=>points.map(([lon,lat])=>({lon,lat}));
  const source=convertArea({elements:[
    {type:'way',id:1,tags:{highway:'residential'},geometry:geometry([[0,.002],[.004,.002]])},
    {type:'way',id:2,tags:{building:'yes'},geometry:geometry([[.001,.00205],[.0012,.00205],[.0012,.00215],[.001,.00215],[.001,.00205]])}
  ]},{bounds,width:900,height:900,id:'local-mapped',name:'Mapped',seed:'mapped',regional:true,settlement:{type:'hamlet'}}).map;
  const building=source.locations.find(p=>p.id==='osm-way-2-0');building.overrides={name:'Kept House'};
  const next=regenerateLayout(source,settings).map;validateMap(next);
  for(const id of ['osm-way-1-0','osm-way-2-0'])assert.deepEqual(next.locations.find(p=>p.id===id).shape,source.locations.find(p=>p.id===id).shape);
  assert.equal(next.locations.find(p=>p.id===building.id).overrides.name,'Kept House');
  assert.equal(next.locations.find(p=>p.id===building.id).context.street,'osm-way-1-0');
  assert.equal(next.worldImport.procedural.decisions.buildings.mode,'mapped');
  assert.equal(next.worldImport.procedural.decisions.cityStreets.mode,'mapped');
});
test('layout work runs in a cancellable worker and matches direct regeneration',async()=>{
  const previous=globalThis.Worker,workers=[];
  globalThis.Worker=class {
    constructor(url) {
      const code=`import {parentPort} from 'node:worker_threads';globalThis.self={postMessage:data=>parentPort.postMessage(data)};parentPort.on('message',data=>self.onmessage({data}));await import(${JSON.stringify(url.href)});`;
      this.thread=new NodeWorker(new URL('data:text/javascript,'+encodeURIComponent(code)));workers.push(this);
      this.thread.on('message',data=>this.onmessage?.({data}));this.thread.on('error',error=>this.onerror?.({message:error.message}));
    }
    postMessage(data){this.thread.postMessage(data);}
    terminate(){this.terminated=true;this.thread.terminate();}
  };
  try {
    const source=importedMap(),stages=[];
    const actual=await regenerateInWorker(source,settings,{onProgress:s=>stages.push(s)});
    assert.deepEqual(actual,regenerateLayout(source,settings));assert.ok(stages.length>5);
    const controller=new AbortController(),pending=regenerateInWorker(source,settings,{signal:controller.signal});
    controller.abort();await assert.rejects(pending,{name:'AbortError'});
    assert.ok(workers.every(w=>w.terminated));
  } finally {globalThis.Worker=previous;}
});
