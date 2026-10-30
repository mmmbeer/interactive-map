import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateMap, validateProject } from '../scripts/validation.mjs';
import { buildSpatialIndex, hitTest, matches } from '../public/js/spatial.js';
import { escape } from '../public/js/ui.js';
const map={id:'demo',name:'Demo',subtitle:'A city',theme:'City',region:'A coast',description:'An example',image:'map.webp',thumbnail:'thumb.webp',width:100,height:100,locations:[{id:'place-1',name:'Venn House',category:'home',x:31,y:20,bounds:[29,18,6,6],district:'Old Town',description:'A family home.',person:'Mira Venn'}]};
test('every real map and script passes the content contract',async()=>{
  const result=await validateProject(new URL('..',import.meta.url).pathname);
  assert.ok(result.maps>=1);assert.ok(result.locations>=54);
});
test('invalid points, categories, bounds and duplicate ids fail validation',()=>{
  for(const change of [{x:101},{category:'unknown'},{bounds:[99,99,4,4]},{x:NaN}]) {
    const copy=structuredClone(map);Object.assign(copy.locations[0],change);assert.throws(()=>validateMap(copy));
  }
  const copy=structuredClone(map);copy.locations.push({...copy.locations[0]});assert.throws(()=>validateMap(copy),/duplicate/);
});
test('hit detection spans spatial cells and respects category visibility',()=>{
  const places=map.locations,index=buildSpatialIndex(places);
  assert.equal(hitTest(index,places,33,20)?.id,'place-1');
  assert.equal(hitTest(index,places,33,20,1,()=>false),null);
  assert.equal(hitTest(index,places,90,90),null);
});
test('landmark hit targets remain usable at different zoom levels',()=>{
  const places=[{...map.locations[0],featured:true}],index=buildSpatialIndex(places);
  assert.equal(hitTest(index,places,48,20,1)?.id,'place-1');
  assert.equal(hitTest(index,places,48,20,4),null);
  assert.equal(hitTest(index,places,48,20,1,()=>true,false),null);
  assert.equal(hitTest(index,places,48,20,1,()=>true,true,()=>false),null);
});
test('search finds residents and combines district and category filters',()=>{
  const p=map.locations[0];assert.equal(matches(p,{query:'MIRA'}),true);
  assert.equal(matches(p,{query:'mira',category:'home',district:'Old Town'}),true);
  assert.equal(matches(p,{query:'mira',category:'shop'}),false);
  assert.equal(matches(p,{district:'Harbor'}),false);
});
test('authored map text is escaped before rendering',()=>{
  assert.equal(escape('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});
