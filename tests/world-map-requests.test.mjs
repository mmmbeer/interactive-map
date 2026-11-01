import test from 'node:test';
import assert from 'node:assert/strict';
import { requestMapData, MapRequestError } from '../public/js/world-maps/request.js';
import { fetchArea } from '../public/js/world-maps/source.js';
import { canvasBlob } from '../public/js/world-maps/render.js';
const bounded=(name,fn)=>test(name,{timeout:2000},fn);
const area=n=>({west:0,south:0,east:.01+n*.0001,north:.01});
const data=id=>({elements:[{type:'node',id,lat:.001,lon:.001}]});
const json=body=>new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}});
const never=()=>new Promise(()=>{});

bounded('the deadline settles even when fetch ignores its abort signal',async()=>{
  let transportSignal;
  await assert.rejects(requestMapData('https://test.invalid','query',{timeoutMs:15,fetcher:(_url,o)=>{transportSignal=o.signal;return never();}}),e=>e instanceof MapRequestError&&e.retryable);
  assert.equal(transportSignal.aborted,true);
});

bounded('the same deadline covers a stalled response body and cancels its reader',async()=>{
  let cancelled=false;
  const response={ok:true,headers:new Headers(),body:{getReader:()=>({read:never,cancel:async()=>{cancelled=true;},releaseLock(){}})}};
  await assert.rejects(requestMapData('https://test.invalid','query',{timeoutMs:15,fetcher:async()=>response}),/too long/);
  assert.equal(cancelled,true);
});

bounded('cancellation settles stalled JSON decoding without waiting for the deadline',async()=>{
  const controller=new AbortController();let reading;
  const started=new Promise(resolve=>{reading=resolve;});
  const pending=requestMapData('https://test.invalid','query',{signal:controller.signal,fetcher:async()=>({ok:true,headers:new Headers(),json:()=>{reading();return never();}})});
  await started;controller.abort();await assert.rejects(pending,{name:'AbortError'});
});

bounded('a stalled primary service falls back and a late primary reply cannot overwrite the cached result',async()=>{
  let late;const calls=[],progress=[];
  const result=await fetchArea(area(1),undefined,{services:['https://first.invalid','https://second.invalid'],timeoutMs:15,onProgress:p=>progress.push(p),fetcher:async url=>{
    calls.push(url);return url.includes('first')?new Promise(resolve=>{late=resolve;}):json(data(2));
  }});
  assert.deepEqual(result,data(2));assert.equal(calls.length,2);assert.ok(progress.some(p=>p.stage==='fallback'));
  late(json(data(1)));await new Promise(resolve=>setTimeout(resolve,0));
  assert.deepEqual(await fetchArea(area(1),undefined,{fetcher:()=>{throw new Error('Cache was lost');}}),data(2));
});

bounded('transient errors and incomplete results fall back without accepting partial map data',async()=>{
  for(const [i,response] of [new Response('Unavailable',{status:503}),json({remark:'runtime error',elements:data(7).elements})].entries()) {
    let calls=0;
    const result=await fetchArea(area(2+i),undefined,{services:[`https://bad-${i}.invalid`,`https://good-${i}.invalid`],fetcher:async()=>++calls===1?response:json(data(8))});
    assert.equal(calls,2);assert.deepEqual(result,data(8));
  }
});

bounded('all services failing produces a bounded, actionable error',async()=>{
  let calls=0;
  await assert.rejects(fetchArea(area(4),undefined,{services:['https://dead-a.invalid','https://dead-b.invalid'],timeoutMs:10,fetcher:()=>{calls++;return never();}}),/selection has been kept/);
  assert.equal(calls,2);
});

bounded('caller cancellation stops retries and a cancelled request never poisons the next attempt',async()=>{
  const controller=new AbortController();let calls=0;
  const services=['https://cancel-a.invalid','https://cancel-b.invalid'];
  const pending=fetchArea(area(5),controller.signal,{services,fetcher:()=>{calls++;return never();}});
  controller.abort();await assert.rejects(pending,{name:'AbortError'});assert.equal(calls,1);
  assert.deepEqual(await fetchArea(area(5),undefined,{services,fetcher:async()=>json(data(9))}),data(9));
  const cancelled=new AbortController();cancelled.abort();await assert.rejects(fetchArea(area(5),cancelled.signal),{name:'AbortError'});
});

bounded('rate limits do not trigger failover or immediate retry',async()=>{
  let calls=0;const services=['https://limited.invalid','https://unused.invalid'];
  const options={services,fetcher:async()=>{calls++;return new Response('',{status:429});}};
  await assert.rejects(fetchArea(area(6),undefined,options),/busy/);assert.equal(calls,1);
  await assert.rejects(fetchArea(area(6),undefined,options),/Wait a minute/);assert.equal(calls,1);
});

bounded('streamed responses report bytes and enforce the size limit without Content-Length',async()=>{
  const progress=[];
  assert.deepEqual(await requestMapData('https://test.invalid','query',{fetcher:async()=>json(data(10)),onProgress:p=>progress.push(p)}),data(10));
  assert.ok(progress.some(p=>p.stage==='receiving'&&p.bytes>0));
  await assert.rejects(requestMapData('https://test.invalid','query',{maxBytes:10,fetcher:async()=>json(data(10))}),/unusually large/);
});

bounded('image encoding can be cancelled while preserving the preview for retry',async()=>{
  const controller=new AbortController();let complete;
  const pending=canvasBlob({toBlob:fn=>{complete=fn;}},'image/png',controller.signal);
  controller.abort();await assert.rejects(pending,{name:'AbortError'});complete(new Blob(['late']));
  assert.ok(await canvasBlob({toBlob:fn=>fn(new Blob(['ok']))}) instanceof Blob);
});
