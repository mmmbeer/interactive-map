import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DirectorySearch} from '../public/js/directory-search.js';
import {Worker} from 'node:worker_threads';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
const fixture=()=>({id:'demo',name:'Demo',subtitle:'A city',theme:'City',region:'Coast',description:'Example',
  image:'assets/map.webp',thumbnail:'assets/thumb.webp',width:100,height:100,
  locations:[{id:'home',name:'Home',description:'Home',district:'Old Town',category:'home',x:50,y:50}]});

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
