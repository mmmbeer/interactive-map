import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ancestries, settlementProfiles, settlementPeople } from '../public/js/generation/settlement-pools-v1.js';
import { applySettings, defaultSettings, normalizeSettings, readSettings, saveSettings, settingsURL } from '../public/js/generation/settlement-settings.js';
import { resolveLocation, materializeMap } from '../public/js/generation/locations.js';
import { validateMap } from '../public/js/map-contract.js';
import { matches } from '../public/js/spatial.js';
import { serializeMap } from '../public/js/authoring/model.js';

const place=(id,category='home',type=category)=>({id,category,type,district:'ward',x:40,y:50});
const makeMap=()=>({schemaVersion:2,id:'test',name:'Test',subtitle:'Test coast',description:'A test',region:'Coast',theme:'City',image:'map.webp',thumbnail:'thumb.webp',width:100,height:100,
  generator:{version:2,seed:'world-42',defaults:{demographics:{races:{human:1,elf:1}}}},
  regions:[{id:'coast',name:'The Coast',generation:{demographics:{race:'gnome'}}}],
  districts:[{id:'ward',name:'The Ward',region:'coast',generation:{demographics:{race:'orc'}}}],
  locations:[place('river','water','river'),place('lane','street','lane'),
    {...place('shop','shop','apothecary'),context:{street:'lane',water:'river'},generation:{tables:{description:['{displayName} on {street}, beside {water}.']}}},
    {...place('home'),generation:{demographics:{races:{elf:1,dwarf:2},cultures:{ancestral:1},gender:'female',wealth:'wealthy'}}},
    {...place('landmark','landmark'),overrides:{name:'The Old Beacon',description:'An authored description.',person:'An authored keeper.'}}]});
const snapshot=map=>JSON.parse(JSON.stringify(materializeMap(map).locations));
const settings=(ancestry='human',seed='world-42')=>({ancestry,seed});

test('every ancestry has robust identity pools and each new place bank has 100 distinct entries',()=>{
  for(const ancestry of Object.keys(ancestries)) {
    for(const [part,values] of Object.entries(settlementPeople(ancestry))) {
      assert.ok(values.length>=100,`${ancestry} ${part}`);
      assert.equal(new Set(values).size,values.length);
    }
    if(ancestry==='human')continue; // Human uses the frozen v2 banks covered by generation-v2.test.
    for(const [part,values] of Object.entries(settlementProfiles[ancestry])) {
      assert.ok(values.length>=100,`${ancestry} ${part}`);
      assert.equal(new Set(values).size,values.length);
      assert.ok(values.every(v=>typeof v==='string' && v.trim() && !/\d/.test(v)));
    }
  }
});
test('Human is default and the selected ancestry overrides inherited races and cultures only in the runtime copy',()=>{
  const source=makeMap(),before=serializeMap(source);
  assert.deepEqual(defaultSettings(source),settings());
  for(const ancestry of Object.keys(ancestries)) {
    const map=applySettings(source,settings(ancestry));validateMap(map);
    for(const p of snapshot(map).filter(p=>!['water','street','terrain'].includes(p.category))) {
      assert.equal(p.demographics.race,ancestry);assert.equal(p.demographics.culture,'ancestral');
    }
    const home=snapshot(map).find(p=>p.id==='home');
    assert.equal(home.demographics.gender,'female');assert.equal(home.demographics.wealth,'wealthy');
    for(const [i,p] of map.locations.entries()) {
      for(const key of ['id','category','type','district','x','y','context','overrides']) assert.deepEqual(p[key],source.locations[i][key]);
    }
  }
  assert.equal(serializeMap(source),before);
});
test('names, people, search and linked geographic references use the same ancestry and seed',()=>{
  const source=makeMap();
  for(const ancestry of Object.keys(ancestries)) {
    const map=applySettings(source,settings(ancestry)),first=snapshot(map);
    assert.deepEqual(snapshot(applySettings(JSON.parse(JSON.stringify(source)),settings(ancestry))),first);
    const [river,lane,shop,,landmark]=first;
    assert.ok(shop.address.endsWith(lane.name));assert.ok(shop.description.includes(river.name));
    assert.ok(shop.description.includes(shop.name));assert.ok(matches(shop,{query:lane.name}));
    assert.equal(landmark.name,'The Old Beacon');assert.equal(landmark.description,'An authored description.');
    assert.equal(landmark.person,'An authored keeper.');
    const other=snapshot(applySettings(source,settings(ancestry,'another seed')));
    assert.notEqual(other[2].name,shop.name);assert.notEqual(other[2].person,shop.person);
    assert.equal(other[4].name,landmark.name);
    assert.deepEqual(snapshot(applySettings(source,settings(ancestry))),first);
    if(ancestry==='human')continue;
    const profile=settlementProfiles[ancestry];
    assert.ok(profile.waterRoots.some(root=>river.name.includes(root)) || profile.surnames.some(root=>river.name.includes(root)));
    assert.ok(profile.streetRoots.some(root=>lane.name.includes(root)) || profile.surnames.some(root=>lane.name.includes(root)));
  }
});
test('inserting, reordering and moving unrelated places cannot reroll existing identities',()=>{
  const source=makeMap(),before=snapshot(applySettings(source,settings('dragonborn')));
  source.locations.reverse();source.locations[0].x=20;source.locations.push(place('extra'));
  const after=snapshot(applySettings(source,settings('dragonborn')));
  for(const p of before) {
    const next=after.find(n=>n.id===p.id);
    for(const key of ['name','person','description','address'])assert.equal(next[key],p[key]);
  }
});
test('As authored restores the released generator output exactly, including numeric seeds',()=>{
  const source=makeMap();source.generator.seed=42;
  const restored=applySettings(source,{ancestry:'original',seed:'42'});
  assert.equal(restored.generator.seed,42);assert.deepEqual(snapshot(restored),snapshot(source));
});
test('custom templates and people pools remain deliberate catalog inputs',()=>{
  const source=makeMap();source.generator.catalog={
    people:{elf:{female:['Custom'],male:['Custom'],nonbinary:['Custom'],surnames:['Family']}},
    tables:{root:['Customroot'],street:['Custom Street']},
    types:{home:{category:'home',label:'home',nouns:['Home'],roles:['resident'],services:['lodging'],tables:{name:['{surname} Household']}}}
  };
  const map=applySettings(source,settings('elf'));validateMap(map);
  const p=snapshot(map).find(p=>p.id==='home');assert.equal(p.name,'Family Household');assert.match(p.person,/Custom Family/);assert.match(p.address,/Custom Street$/);
});
test('ancestry naming has broad variety across places rather than a short repeated list',()=>{
  for(const ancestry of Object.keys(settlementProfiles)) {
    const source=makeMap();source.locations=Array.from({length:400},(_,i)=>place(`home-${i}`));
    const names=new Set(snapshot(applySettings(source,settings(ancestry))).map(p=>p.name));
    assert.ok(names.size>340,`${ancestry}: ${names.size} distinct names`);
  }
});
test('both published maps accept every ancestry and preserve their compact source',async()=>{
  for(const id of ['dragonsgate','grayhaven']) {
    const source=JSON.parse(await readFile(new URL(`../public/data/maps/${id}.json`,import.meta.url),'utf8'));
    const before=JSON.stringify(source);
    for(const ancestry of Object.keys(ancestries)) {
      const map=applySettings(source,settings(ancestry));validateMap(map);
      for(const p of materializeMap(map).locations.filter(p=>!p.overrides?.name).slice(0,15)) {
        for(const field of ['name','person','description','address']) assert.doesNotMatch(p[field],/undefined|null|[{}]/);
      }
    }
    assert.equal(JSON.stringify(source),before);
  }
});
test('v1 maps can opt into ancestry and seed settings without changing released defaults',()=>{
  const source=makeMap();source.generator.version=1;source.locations=[place('home')];
  const before=snapshot(source);
  for(const ancestry of Object.keys(ancestries)) {
    const map=applySettings(source,settings(ancestry));validateMap(map);
    const p=snapshot(map)[0];assert.equal(p.demographics.race,ancestry);assert.doesNotMatch(p.name,/undefined|[{}]/);
  }
  assert.deepEqual(snapshot(source),before);
});
test('settings round trip in URLs and per-map storage, including special seed characters',()=>{
  const source=makeMap(),values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
  const choice=settings('orc','snow & ice/# + ü');
  assert.equal(saveSettings(source,choice,storage),true);
  assert.deepEqual(readSettings(source,'https://atlas.test/#map/test',storage),choice);
  const second={...source,id:'second'};
  assert.deepEqual(readSettings(second,'https://atlas.test/#map/second',storage),defaultSettings(second));
  const shared=settingsURL('https://atlas.test/?keep=yes#map/test/home',settings('elf',choice.seed));
  assert.equal(shared.hash,'#map/test/home');assert.equal(shared.searchParams.get('keep'),'yes');
  assert.deepEqual(readSettings(source,shared,storage),settings('elf',choice.seed));
  const blocked={getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}};
  assert.equal(saveSettings(source,choice,blocked),false);
  assert.deepEqual(readSettings(source,'https://atlas.test/#map/test',blocked),defaultSettings(source));
  assert.deepEqual(readSettings(source,shared,blocked),settings('elf',choice.seed));
});
test('invalid settings and broken stored preferences fall back safely without evaluating seed text',()=>{
  const source=makeMap();
  for(const input of [{ancestry:'unknown'},{ancestry:['elf']},{seed:''},{seed:'  '},{seed:'x'.repeat(129)},{seed:Infinity}])assert.throws(()=>normalizeSettings(source,input));
  assert.equal(normalizeSettings(source,{seed:'0'}).seed,'0');
  const broken={getItem:()=>'{invalid'};
  assert.deepEqual(readSettings(source,'https://atlas.test/#map/test',broken),defaultSettings(source));
  assert.deepEqual(readSettings(source,'https://atlas.test/?ancestry=bad&seed=test#map/test',broken),defaultSettings(source));
});
