import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {bankRegistry} from '../public/js/generation/wordbanks-v2.js';
import {proseRegistry} from '../public/js/generation/prose-v2.js';
import {people,types,tables,featureHeads} from '../public/js/generation/catalog-v2.js';
import {choose,integer,sample,streams,possessive} from '../public/js/generation/helpers-v2.js';
import {resolveLocation,materializeMap} from '../public/js/generation/locations.js';
import {nameStyles} from '../public/js/generation/locations-v2.js';
import {validateMap} from '../public/js/map-contract.js';
import {serializeMap,newLocation} from '../public/js/authoring/model.js';
import {buildSpatialIndex,hitTest,matches} from '../public/js/spatial.js';
import {contains,boundsFor,traceShape} from '../public/js/geometry.js';
import {detailHTML} from '../public/js/places.js';
const feature=(id,category,type,x=40)=>({id,category,type,district:'quays',x,y:50,shape:{kind:'point'}});
const makeMap=()=>({schemaVersion:2,id:'test',name:'Test',subtitle:'Test coast',description:'A test',region:'Coast',theme:'City',image:'map.webp',thumbnail:'thumb.webp',width:100,height:100,
  generator:{version:2,seed:'world-42'},regions:[{id:'coast',name:'The Coast'}],districts:[{id:'quays',name:'The Quays',region:'coast'}],
  locations:[feature('river','water','river',10),{...feature('lane','street','lane',30),context:{water:'river'}},
    {...feature('shop','shop','apothecary',50),context:{street:'lane',water:'river'}}]});
const resolved=m=>materializeMap(m).locations;
const snapshot=p=>JSON.parse(JSON.stringify(p));
test('all v2 lexical banks have at least 100 distinct nonempty entries',()=>{
  const banks={...bankRegistry,...proseRegistry};
  for(const [key,pool] of Object.entries(people)) for(const [part,values] of Object.entries(pool)) banks[`${key}.${part}`]=values;
  for(const [key,type] of Object.entries(types)) for(const part of ['nouns','roles','services']) banks[`${key}.${part}`]=type[part];
  for(const key of ['adjective','animal','symbol','street']) banks[`table.${key}`]=tables[key];
  for(const [key,values] of Object.entries(banks)) {
    assert.ok(values.length>=100,key);assert.equal(new Set(values).size,values.length,key);
    assert.ok(values.every(v=>typeof v==='string' && v.trim()),key);
  }
});
test('strict helpers reject malformed weights, seeds and ranges and exclude zero weights',()=>{
  for(const entries of [[],[{value:'x',weight:-1}],[{value:'x',weight:Infinity}],[{value:'x',weight:0}],[{value:'x',weight:NaN}]]) assert.throws(()=>choose(entries,()=>0));
  assert.equal(choose([{value:'never',weight:0},{value:'yes',weight:1}],()=>0),'yes');
  assert.equal(choose([{value:'yes',weight:1},{value:'never',weight:0}],()=>1-Number.EPSILON),'yes');
  for(const n of [1,-1,NaN,Infinity]) assert.throws(()=>choose(['x'],()=>n));
  assert.throws(()=>streams([undefined]));assert.throws(()=>streams({n:NaN}));
  assert.throws(()=>integer(3,2,()=>0));assert.throws(()=>sample(['a'],2,()=>0));
  assert.equal(integer(1,199,()=>0),1);assert.equal(integer(1,199,()=>1-Number.EPSILON),199);
  assert.equal(new Set(sample(['a','b','c'],3,streams('sample')('pick'))).size,3);
  assert.equal(possessive('James'),'James’');assert.equal(possessive('Mira'),'Mira’s');
});
test('v2 preserves identities across reloads, geometry, order, unrelated insertions and enabled fields',()=>{
  const m=makeMap();validateMap(m);const before=resolved(m).map(snapshot);
  assert.deepEqual(resolved(JSON.parse(JSON.stringify(m))).map(snapshot),before);
  m.locations.reverse();m.locations[0].x=70;m.locations.push(feature('pond','water','pond'));
  const p=resolveLocation(m,m.locations.find(p=>p.id==='shop'));
  for(const key of ['name','person','description','address']) assert.equal(p[key],before[2][key]);
  m.locations[0].generation={fields:['name','person']};
  assert.equal(resolveLocation(m,m.locations[0]).name,p.name);
  assert.equal(resolveLocation(m,m.locations[0]).person,p.person);
});
test('linked names agree across addresses, lore and overrides without changing unrelated places',()=>{
  const m=makeMap(),before=resolved(m),river=before[0],lane=before[1],shop=before[2];
  assert.ok(shop.address.endsWith(lane.name));assert.ok(lane.description.includes(river.name));
  assert.ok(shop.description.includes(shop.name));
  m.locations[0].overrides={name:'The Glass River'};
  const next=resolved(m);assert.ok(next[1].description.includes('The Glass River'));
  assert.ok(next[2].address.endsWith(next[1].name));assert.equal(next[2].person,shop.person);
  m.locations[2].overrides={name:'Mira’s Remedies'};
  assert.ok(resolved(m)[2].description.includes('Mira’s Remedies'));
  assert.equal(resolved(m)[0].person,'');assert.equal(resolved(m)[0].demographics,undefined);
});
test('unlinked buildings share a deterministic district street',()=>{
  const m=makeMap();m.locations=[feature('one','home','home'),feature('two','home','home')];
  const [one,two]=resolved(m);assert.equal(one.address.replace(/^\d+ /,''),two.address.replace(/^\d+ /,''));
});
test('every geographic type and naming structure resolves without commercial text or missing tokens',()=>{
  const m=makeMap();
  for(const [kind,type] of Object.entries(types).filter(([key])=>Object.hasOwn(featureHeads,key))) {
    for(const nameStyle of nameStyles) {
      const p={...feature('sample',type.category,kind),generation:{nameStyle}};
      const r=resolveLocation({...m,locations:[p]},p);
      assert.ok(r.name.includes(featureHeads[kind]),`${kind}: ${r.name}`);
      for(const key of ['name','description','rumor','address']) assert.doesNotMatch(r[key],/undefined|null|[{}]/);
      assert.equal(r.person,'');assert.equal(r.services,'');assert.doesNotMatch(r.address,/^\d+ /);
    }
  }
});
test('varied compositions retain type and show broad diversity across seeds',()=>{
  const m=makeMap(),names=new Set(),shapes=new Set();
  for(let n=0;n<1000;n++) {
    const p={...feature(`lake-${n}`,'water','lake'),generation:{version:2}};
    const name=resolveLocation({...m,locations:[p]},p).name;names.add(name);
    shapes.add(/ of /.test(name)?'of':/’/.test(name)?'possessive':/The Quays/.test(name)?'district':/^The /.test(name)?'article':name.split(' ').length===2?'simple':'descriptive');
    assert.ok(name.includes('Lake'));assert.doesNotMatch(name,/[{}]/);
  }
  assert.ok(names.size>900,`${names.size} distinct names`);assert.equal(shapes.size,6);
});
test('v2 respects inherited cultures, demographics, custom types, fields and table precedence',()=>{
  const m=makeMap();m.generator.defaults={demographics:{race:'elf',gender:'nonbinary',wealth:'wealthy'}};
  m.generator.catalog={people:{local:{female:['Ada'],male:['Ben'],nonbinary:['Ren'],surnames:['Oak']}},cultures:{local:{namePool:'local'}},sections:{hours:{label:'Hours',templates:['Open at {displayName} in {district}.']}}};
  m.locations[2].generation={demographics:{culture:'local'},fields:['name','description','person','hours'],tables:{name:['{firstPossessive} {nameLabel}']}};
  validateMap(m);const p=resolved(m)[2];assert.equal(p.name,'Ren’s Apothecary');assert.match(p.person,/Ren Oak, adult elf/);
  assert.equal(p.demographics.wealth,'wealthy');assert.ok(p.extra.hours.text.includes(p.name));assert.equal(p.address,'');
  m.locations[2].overrides={hours:'<script>closed</script>'};assert.match(detailHTML(resolved(m)[2]),/&lt;script&gt;/);
});
test('bad references, cycles, versions and malformed templates fail validation',()=>{
  const changes=[
    m=>m.locations[2].context={street:'missing'},m=>m.locations[2].context={street:'river'},
    m=>m.locations[1].context={street:'lane'},m=>m.locations[0].context={water:'other'},
    m=>m.locations[2].generation={version:3},m=>m.locations[2].generation={nameStyle:'nonsense'},
    m=>m.locations[2].generation={tables:{name:['{head']}},m=>m.locations[2].generation={tables:{name:['{displayName}']}},
    m=>m.locations[2].generation={tables:{description:['{unknown}']}},m=>m.generator.defaults={demographics:{races:{human:1e308,elf:1e308}}}
  ];
  for(const change of changes) {const m=makeMap();change(m);assert.throws(()=>validateMap(m),undefined,String(change));}
  const m=makeMap();m.locations.push(feature('other','water','lake'));m.locations[0].context={water:'other'};m.locations[3].context={water:'river'};
  assert.throws(()=>validateMap(m),/cyclic/);assert.throws(()=>resolved(m)[0].name,/Cyclic/);
});
test('polyline hit tests follow segments, round endpoints and width across spatial cells',()=>{
  const m=makeMap();m.locations=[{...feature('route','street','street'),x:40,y:40,shape:{kind:'polyline',width:8,points:[[10,10],[70,10],[70,80]]}}];
  validateMap(m);const p=m.locations[0],index=buildSpatialIndex([p]);
  assert.deepEqual(boundsFor(p),[6,6,68,78]);
  assert.equal(contains(p,30,13),true);assert.equal(contains(p,30,15),false);assert.equal(contains(p,70,50),true);assert.equal(contains(p,72,82),true);assert.equal(contains(p,40,40),false);
  assert.equal(hitTest(index,[p],40,11)?.id,'route');assert.equal(hitTest(index,[p],40,40),null);
  const calls=[],ctx=new Proxy({},{get:(_,key)=>(...args)=>calls.push([key,...args])});traceShape(ctx,p);assert.equal(calls.some(c=>c[0]==='closePath'),false);
  for(const shape of [{kind:'polyline',width:0,points:[[1,1],[9,9]]},{kind:'polyline',width:2,points:[[1,1]]},{kind:'polyline',width:2,points:[[1,1],[1,1]]},{kind:'polyline',width:4,points:[[0,0],[10,10]]}]) {
    m.locations[0].shape=shape;assert.throws(()=>validateMap(m));
  }
});
test('new locations opt into v2 and compact serialization keeps references, not resolved text',()=>{
  const m=makeMap();m.generator.version=1;
  const p=newLocation(m);assert.equal(p.generation.version,2);assert.equal(p.name,undefined);
  const source=makeMap(),json=serializeMap(source);assert.equal(JSON.parse(json).locations[2].name,undefined);
  assert.equal(JSON.parse(json).locations[2].context.street,'lane');
  const shop=resolved(source)[2];assert.equal(matches(shop,{query:resolved(source)[1].name}),true);
});
test('Dragonsgate keeps all 7,085 historical inputs unchanged and adds 24 valid mapped features',async()=>{
  const m=JSON.parse(await readFile(new URL('../public/data/maps/dragonsgate.json',import.meta.url),'utf8'));
  validateMap(m);assert.equal(m.locations.length,7109);
  const added=m.locations.slice(7085);assert.equal(added.length,24);
  let hash=2166136261;for(const c of JSON.stringify(m.locations.slice(0,7085))) hash=Math.imul(hash^c.charCodeAt(0),16777619);
  assert.equal((hash>>>0).toString(16),'4a3d9a18','Original location inputs must remain byte-for-byte equivalent.');
  for(const p of added) {assert.equal(p.generation.version,2);assert.ok(['street','water','terrain'].includes(p.category));const r=resolveLocation(m,p);assert.doesNotMatch(r.name+r.description,/[{}]|undefined/);}
});

test('v2 geographic lexicons and fallback street tables are configurable',()=>{
  const m=makeMap();
  m.generator.catalog={tables:{waterRoot:['Salmon'],epithet:['Reedwalker'],street:['Custom Way']}};
  m.locations[0].generation={nameStyle:'simple'};
  m.locations[2].context={water:'river'};
  validateMap(m);
  const p=resolved(m);assert.equal(p[0].name,'Salmon River');assert.ok(p[2].address.endsWith('Custom Way'));
  m.locations[0].generation={nameStyle:'simple',tables:{root:[{value:'Rain',weight:1},{value:'Never',weight:0}]}};
  assert.equal(resolved(m)[0].name,'Rain River');
});

test('custom geographic types keep physical descriptions and omit business profiles',()=>{
  const m=makeMap();m.generator.catalog={types:{spring:{category:'water',label:'spring',nouns:['Spring'],roles:['keeper'],services:['water']}}};
  const p={...feature('spring','water','spring')};m.locations.push(p);validateMap(m);
  const r=resolveLocation(m,p);assert.equal(r.person,'');assert.equal(r.services,'');assert.match(r.description,/waters|spring|outline/);
});
