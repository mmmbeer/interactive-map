import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sharedRequest} from '../public/js/shared-request.js';
import {responseJSON} from '../public/js/response-json.js';
import {ContentClient} from '../public/js/integrations/client.js';
import {loadJSON} from '../public/js/map-data.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const board=()=>({apiVersion:'1',key:'same',links:{player:'https://help.dndadventurerslog.com/'},quests:[{title:'Title',body:'Body',links:{player:'https://help.dndadventurerslog.com/'}}]});
const storage={getItem(){return null;},setItem(){}};
test('identical concurrent requests share work with independent caller cancellation',async()=>{
  const pending=new Map(),a=new AbortController(),b=new AbortController();let calls=0,finish,upstream;
  const start=signal=>{calls++;upstream=signal;return new Promise(resolve=>{finish=resolve;});};
  const first=sharedRequest(pending,'same',a.signal,start),second=sharedRequest(pending,'same',b.signal,start);
  await tick();a.abort();await assert.rejects(first,{name:'AbortError'});
  assert.equal(calls,1);assert.equal(upstream.aborted,false);
  finish('ok');assert.equal(await second,'ok');assert.equal(pending.size,0);
});
test('last caller cancellation stops upstream work and failures allow retries',async()=>{
  const pending=new Map(),controller=new AbortController();let upstream;
  const request=sharedRequest(pending,'same',controller.signal,signal=>{upstream=signal;return new Promise(()=>{});});
  await tick();controller.abort();await assert.rejects(request,{name:'AbortError'});
  assert.equal(upstream.aborted,true);assert.equal(pending.size,0);
  await assert.rejects(sharedRequest(pending,'same',null,async()=>{throw new Error('failed');}),/failed/);
  assert.equal(await sharedRequest(pending,'same',null,async()=>'retry'),'retry');
});
test('bounded JSON readers reject advertised and streamed oversized bodies and cancel the stream',async()=>{
  let cancelled=false;
  const response=new Response(new ReadableStream({pull(c){c.enqueue(new Uint8Array(65));},cancel(){cancelled=true;}}));
  await assert.rejects(responseJSON(response,{maxBytes:64}),/too large/);assert.equal(cancelled,true);
  await assert.rejects(responseJSON(new Response('{}',{headers:{'Content-Length':'999'}}),{maxBytes:64}),/too large/);
  assert.deepEqual(await responseJSON(Response.json({ok:true})),{ok:true});
});
test('body cancellation interrupts a pending read without parsing or caching content',async()=>{
  const controller=new AbortController();let cancelled=false;
  const response=new Response(new ReadableStream({pull(){},cancel(){cancelled=true;}}));
  const result=responseJSON(response,{signal:controller.signal});controller.abort();
  await assert.rejects(result,{name:'AbortError'});assert.equal(cancelled,true);
});
test('connected content deduplicates options and generation and rejects aborted cache reads',async()=>{
  let calls=0;
  const client=new ContentClient({storage,fetcher:async url=>{calls++;await tick();return Response.json(url.endsWith('options')?{apiVersion:'1',locations:[]}:board());}});
  await Promise.all([client.getOptions('quests'),client.getOptions('quests')]);assert.equal(calls,1);
  await Promise.all([client.generate('quests',{}),client.generate('quests',{})]);assert.equal(calls,2);
  const controller=new AbortController();controller.abort();await assert.rejects(client.generate('quests',{},controller.signal),{name:'AbortError'});
  await assert.rejects(client.getOptions('quests',controller.signal),{name:'AbortError'});
});
test('oversized connected content is not cached and a later request can succeed',async()=>{
  let calls=0;
  const client=new ContentClient({storage,fetcher:async()=>++calls===1?new Response('x'.repeat(1024*1024+1)):Response.json(board())});
  await assert.rejects(client.generate('quests',{}),/too large/);assert.equal((await client.generate('quests',{})).key,'same');assert.equal(calls,2);
});
test('preview and viewer map reads reuse bounded cached data without sharing mutations',async()=>{
  const oldFetch=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;await tick();return Response.json({locations:[{id:'original'}]});};
  try {
    const [a,b]=await Promise.all([loadJSON('audit-map.json'),loadJSON('audit-map.json')]);assert.equal(calls,1);
    a.locations[0].id='edited';assert.equal(b.locations[0].id,'original');
    assert.equal((await loadJSON('audit-map.json')).locations[0].id,'original');assert.equal(calls,1);
    for(let i=0;i<3;i++)await loadJSON(`other-${i}.json`);
    await loadJSON('audit-map.json');assert.equal(calls,5);
  } finally {globalThis.fetch=oldFetch;}
});
