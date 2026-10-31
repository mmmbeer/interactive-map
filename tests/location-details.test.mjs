import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detailSources } from '../public/js/generation/detail-sources-v1.js';
import { detailFields, detailSections } from '../public/js/generation/details-v1.js';
import { recipe, matchingSources, uniqueChoices, priceFor } from '../public/js/generation/detail-helpers-v1.js';
import { streams } from '../public/js/generation/helpers-v2.js';
import { types } from '../public/js/generation/catalog-v2.js';
import { resolveLocation, materializeMap } from '../public/js/generation/locations.js';
import { validateMap } from '../public/js/map-contract.js';
import { serializeMap } from '../public/js/authoring/model.js';
import { detailHTML } from '../public/js/places.js';
import { guideEntryHTML } from '../public/js/guide-entry.js';
import { entrySections } from '../public/js/site-index.js';
import { matches } from '../public/js/spatial.js';
import { render } from '../public/js/generation/random.js';

const place=(id,type,category=types[type]?.category || type)=>({id,type,category,district:'quays',x:40,y:50});
const makeMap=()=>({schemaVersion:2,id:'details-test',name:'Details',subtitle:'Test town',description:'A test town',region:'Test coast',theme:'City',image:'map.webp',thumbnail:'thumb.webp',width:100,height:100,
  generator:{version:2,seed:'detail-world',defaults:{demographics:{race:'elf',gender:'nonbinary',wealth:'comfortable'}}},
  districts:[{id:'quays',name:'The Quays'}],locations:[place('inn','tavern'),place('smith','blacksmith'),place('river','river')]});
const snapshot=p=>{const {siteNumber,...content}=JSON.parse(JSON.stringify(p));return content;};
test('every compiled content recipe has 100 distinct rendered variations within a fixed context',()=>{
  const context={displayName:'The Rook',address:'4 Quay Road',district:'Quays',region:'Coast',label:'river',service:'ironwork'};
  for (const [name,values] of Object.entries(detailSources)) {
    assert.ok(values.length>=100,name);
    const expanded=values.map(v=>render(v,context));
    assert.equal(new Set(expanded).size,values.length,name);
    assert.ok(expanded.every(text=>!/[{}]/.test(text)),name);
    // Check attainable selection diversity rather than only a theoretical Cartesian count.
    const selected=new Set(Array.from({length:1200},(_,seed)=>uniqueChoices(values,1,streams([name,seed])('draw'))[0]));
    assert.ok(selected.size>=100,`${name}: ${selected.size}`);
  }
  assert.throws(()=>recipe(['same'],['same']),/100/);
});
test('all supported trades and geographies receive appropriate details without unrelated sections',()=>{
  const m=makeMap();
  m.locations=Object.entries(types).map(([key,type])=>place(key.replaceAll('_','-'),key,type.category));
  assert.doesNotThrow(()=>validateMap(m));
  for (const p of materializeMap(m).locations) {
    for (const [field,section] of Object.entries(detailSections)) {
      assert.equal(Boolean(p.extra[field].text),section.categories.includes(p.category),`${p.type}.${field}`);
      assert.doesNotMatch(p.extra[field].text,/undefined|\{\w+\}|\.\./);
    }
    if (['shop','workshop'].includes(p.category)) assert.ok(detailSources[`stock_${p.type}`],p.type);
    if (p.category==='water') {assert.equal(p.person,'');assert.equal(p.services,'');assert.equal(p.demographics,undefined);}
  }
});
test('details retain identity and references across reloads, field changes, ordering and geometry',()=>{
  const m=makeMap();m.locations[0].context={water:'river'};
  const a=materializeMap(m).locations.map(snapshot);
  assert.deepEqual(materializeMap(JSON.parse(serializeMap(m))).locations.map(snapshot),a);
  const changed=structuredClone(m);changed.locations.reverse();changed.locations[2].x=75;
  changed.locations.push(place('other','shop'));
  assert.deepEqual(snapshot(resolveLocation(changed,changed.locations[2])).extra,a[0].extra);
  const inn=m.locations[0];
  inn.generation={fields:['name','person','lodgings']};
  const partial=resolveLocation(m,inn);
  assert.equal(partial.extra.lodgings.text,a[0].extra.lodgings.text);
  assert.equal(partial.extra.meals.text,'');
  assert.ok(partial.person.includes(partial.extra.lodgings.text.match(/Book with (.+)\./)[1]));
  inn.generation={revision:1};
  assert.notDeepEqual(resolveLocation(m,inn).extra,a[0].extra);
  assert.deepEqual(resolveLocation(m,m.locations[1]).extra,a[1].extra);
  m.generator.seed='another-world';
  assert.notDeepEqual(resolveLocation(m,inn).extra,a[0].extra);
});
test('wealth, vegetarian traits, population and authored contacts remain coherent',()=>{
  const m=makeMap(),p=m.locations[0];
  p.context={water:'river'};p.generation={traits:['vegetarian'],demographics:{wealth:'wealthy'}};
  p.overrides={name:'The Authored Inn',person:'Mara, retired pilot',address:'77 Authored Lane'};
  const inn=resolveLocation(m,p);
  assert.match(inn.extra.meals.text,/The Authored Inn/);
  assert.doesNotMatch(inn.extra.meals.text,/fish|pork|beef|mutton|chicken|duck|venison|rabbit|sausage|goat|lamb/i);
  assert.match(inn.extra.lodgings.text,/Book with the keeper/);
  assert.ok(Number(inn.extra.meals.text.match(/cost (\d+) sp/)[1])>=15);
  assert.ok(Number(inn.extra.lodgings.text.match(/costs (\d+) sp/)[1])>=25);
  p.type='blacksmith';p.category='workshop';
  const smith=resolveLocation(m,p);
  assert.match(smith.extra.commissions.text,/Orders go through the keeper/);
  assert.match(smith.extra.stock.text,/hinges|horseshoes|nails|chisels|axe heads|latches|hooks|chain|rivets|blades/i);
  const home=place('empty','home');home.generation={demographics:{population:0}};
  assert.match(resolveLocation(m,home).extra.household.text,/No permanent residents/);
  home.generation.demographics.population=1;
  assert.match(resolveLocation(m,home).extra.household.text,/One resident/);
  assert.equal(priceFor('unknown',()=>0),'2 sp');
});
test('tagged sources filter before weighted sampling and require 100 variations in each active context',()=>{
  const m=makeMap();
  const source=Array.from({length:100},(_,i)=>({value:`Elven bread number ${i}`,when:{traits:['vegetarian'],water:true},weight:1}));
  source.push(...Array.from({length:100},(_,i)=>({value:`Unavailable bread ${i}`,when:{water:false},weight:1})));
  source.push({value:'Never chosen',weight:0});
  m.generator.catalog={detailSources:{vegetarianMeals:source}};
  const p=m.locations[0];p.context={water:'river'};p.generation={traits:['vegetarian']};
  validateMap(m);
  assert.match(resolveLocation(m,p).extra.meals.text,/Elven bread/);
  assert.doesNotMatch(resolveLocation(m,p).extra.meals.text,/Unavailable|Never/);
  const dry=structuredClone(m);delete dry.locations[0].context;
  validateMap(dry);
  const bad=structuredClone(m);bad.generator.catalog.detailSources.vegetarianMeals.splice(0,1);
  assert.throws(()=>validateMap(bad),/100 matching/);
  const tiny=structuredClone(m);tiny.generator.catalog.detailSources.vegetarianMeals=['one'];
  assert.throws(()=>validateMap(tiny),/100/);
  for (const mutate of [s=>s[0].when.water='yes',s=>s[0].when.typo=true,s=>s[0].weight=-1,s=>s[0].value='{guest}',s=>s[0].value='{unknown}',s=>s[0].value='{broken']) {
    const invalid=structuredClone(m);mutate(invalid.generator.catalog.detailSources.vegetarianMeals);
    assert.throws(()=>validateMap(invalid));
  }
  assert.equal(matchingSources(source,{type:'tavern',category:'tavern',wealth:'modest',traits:['vegetarian'],water:true}).length,100);
  assert.deepEqual(uniqueChoices([{value:'a',weight:0},{value:'b',weight:1},{value:'c',weight:1}],2,()=>0),['b','c']);
  assert.throws(()=>uniqueChoices([{value:'a',weight:-1},'b'],1,()=>0));
  assert.throws(()=>uniqueChoices(['a','a'],2,()=>0));
});
test('detail fields support overrides, custom templates, search, callouts, guide and compact export',()=>{
  const m=makeMap(),p=m.locations[0];
  p.overrides={meals:'<img src=x onerror=alert(1)> unique-test-menu',lodgings:null};
  m.generator.catalog={sections:{guests:{label:'Custom guests',templates:['At {displayName}: {guest}']}}};
  validateMap(m);
  const inn=resolveLocation(m,p);
  assert.equal(inn.extra.lodgings.text,'');
  assert.match(inn.extra.guests.text,/At /);
  assert.ok(matches(inn,{query:'unique-test-menu'}));
  for (const html of [detailHTML(inn),guideEntryHTML(inn,1,m)]) {
    assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img src=x/);
  }
  assert.ok(new Map(entrySections(inn)).has('Meals'));
  const exported=JSON.parse(serializeMap(m));
  assert.equal(exported.locations[0].extra,undefined);
  assert.equal(exported.locations[0].overrides.meals,p.overrides.meals);
  const old=makeMap();old.generator.version=1;old.locations.pop();
  assert.doesNotThrow(()=>validateMap(old));
  assert.ok(resolveLocation(old,old.locations[0]).extra.meals.text);
  assert.equal(detailFields.length,14);
});
