import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { random, pick, canonical } from '../public/js/generation/random.js';
import { resolveLocation, materializeMap } from '../public/js/generation/locations.js';
import { configFor } from '../public/js/generation/config.js';
import { validateMap } from '../public/js/map-contract.js';
import { migrateMap, serializeMap, newLocation, saveLocation } from '../public/js/authoring/model.js';
import { readDraft, writeDraft, clearDraft } from '../public/js/authoring/drafts.js';
import { matches, buildSpatialIndex, hitTest, searchPlaces } from '../public/js/spatial.js';
import { detailHTML, tooltipHTML } from '../public/js/places.js';
const makeMap = () => ({schemaVersion:2,id:'demo',name:'Demo',subtitle:'A city',theme:'City',region:'Coast',description:'A map',image:'map.webp',thumbnail:'thumb.webp',width:100,height:100,
  generator:{version:1,seed:'demo-42',defaults:{}},
  regions:[{id:'coast',name:'The Coast',generation:{traits:['coastal']}}],
  districts:[{id:'old-town',name:'Old Town',region:'coast'}],
  locations:[{id:'place-1',category:'shop',type:'apothecary',district:'old-town',x:30,y:20,bounds:[25,15,10,10]}]
});
const output = map => JSON.parse(JSON.stringify(materializeMap(map).locations[0]));
test('seeded streams canonicalize object keys and ignore external random state',()=>{
  const a=random({a:1,b:2}),b=random({b:2,a:1});
  assert.deepEqual(Array.from({length:10},a),Array.from({length:10},b));
  const saved=Math.random;Math.random=()=>{throw new Error('Global random used');};
  try {assert.equal(output(makeMap()).name,output(makeMap()).name);} finally {Math.random=saved;}
  assert.equal(canonical({b:1,a:2}),'{"a":2,"b":1}');
  assert.equal(pick([{value:'no',weight:0},{value:'yes',weight:1}],random('test')),'yes');
});
test('generation survives JSON reload, location order, insertion and geometry changes',()=>{
  const map=makeMap(),before=output(map);
  assert.deepEqual(output(JSON.parse(JSON.stringify(map))),before);
  map.locations.unshift({...map.locations[0],id:'another'});
  assert.equal(resolveLocation(map,map.locations[1]).name,before.name);
  map.locations.reverse();map.locations[0].x=40;map.locations[0].bounds=[35,15,10,10];
  assert.equal(output(map).name,before.name);assert.equal(output(map).person,before.person);
});
test('field selection and authored overrides do not perturb independent streams',()=>{
  const map=makeMap(),before=output(map);
  map.locations[0].generation={fields:['name','person']};
  const next=output(map);
  assert.equal(next.name,before.name);assert.equal(next.person,before.person);assert.equal(next.rumor,'');
  map.locations[0].overrides={name:'Fixed name',description:'Fixed lore',rumor:null};
  assert.equal(output(map).description,'Fixed lore');assert.equal(output(map).name,'Fixed name');
  assert.equal(output(map).person,before.person);assert.equal(output(map).rumor,'');
  assert.equal(map.locations[0].person,undefined);
});
test('map, region, district and location settings inherit with explicit precedence',()=>{
  const map=makeMap();
  map.generator.defaults={demographics:{race:'human',wealth:'wealthy'},fields:['name','person'],tables:{person:['Map {raceLabel}']}};
  map.regions[0].generation={demographics:{races:{elf:1},gender:'female'},tables:{person:['Region {raceLabel}']}};
  map.districts[0].generation={demographics:{race:'orc'},tables:{person:['District {raceLabel}']}};
  const place=map.locations[0];
  assert.equal(output(map).demographics.race,'orc');assert.equal(output(map).person,'District orc');
  assert.equal(output(map).demographics.wealth,'wealthy');
  place.generation={demographics:{races:{dwarf:1},population:0},tables:{person:['Location {raceLabel} {population}']}};
  validateMap(map);
  assert.equal(output(map).demographics.race,'dwarf');assert.equal(output(map).person,'Location dwarf 0');
  assert.equal(configFor(map,place).config.demographics.race,undefined);
});
test('local tables override type templates and add content without code changes',()=>{
  const map=makeMap();map.locations[0].category='home';delete map.locations[0].type;
  map.locations[0].generation={tables:{name:['Home of {fullName}']}};
  assert.match(output(map).name,/^Home of /);
  map.generator.catalog={tables:{name:['Catalog {district}']}};delete map.locations[0].generation;
  assert.equal(output(map).name,'Catalog Old Town');
});
test('race and naming culture choose consistent name pools and pronouns',()=>{
  const map=makeMap();
  map.generator.catalog={people:{test:{female:['Ada'],male:['Ben'],nonbinary:['Cai'],surnames:['Oak']}},cultures:{riverfolk:{namePool:'test'}}};
  map.locations[0].generation={demographics:{race:'orc',gender:'nonbinary',culture:'riverfolk',age:'elder',population:5}};
  validateMap(map);
  const p=output(map);assert.match(p.person,/^Cai /);assert.match(p.person,/elder orc/);assert.match(p.person,/They /);
  assert.doesNotMatch(p.person,/They (keeps|supports|speaks|collects)\b/);
  assert.equal(p.demographics.population,5);
});
test('version, seed and per-place variation are explicit and isolated',()=>{
  const a=makeMap(),before=output(a);a.locations.push({...a.locations[0],id:'place-2'});
  const other=resolveLocation(a,a.locations[1]).name;
  a.locations[0].generation={revision:1};assert.notEqual(output(a).description,before.description);
  assert.equal(resolveLocation(a,a.locations[1]).name,other);
  a.generator.seed='other';assert.notEqual(output(a).person,before.person);
  a.generator.version=2;assert.throws(()=>validateMap(a),/version/);assert.throws(()=>materializeMap(a),/version/);
});
test('invalid weights, tokens, catalog entries and demographic references fail early',()=>{
  const variants=[
    m=>m.generator.defaults={demographics:{races:{human:0}}},
    m=>m.generator.defaults={demographics:{races:{human:-1}}},
    m=>m.generator.defaults={demographics:{race:'merfolk'}},
    m=>m.generator.defaults={demographics:{race:'elf',races:{human:1}}},
    m=>m.generator.defaults={demographics:{culture:'nowhere'}},
    m=>m.generator.defaults={demographics:{gender:'unknown'}},
    m=>m.generator.defaults={demographics:{population:-1}},
    m=>m.generator.defaults={tables:{name:[]}},
    m=>m.generator.defaults={tables:{name:['{typo}']}},
    m=>m.generator.defaults={fields:['missing']},
    m=>m.generator.defaults={revision:-1},
    m=>m.generator.catalog={people:{human:{female:[]}}},
    m=>m.locations[0].type='blacksmith',
    m=>m.locations[0].type=0,
    m=>m.locations[0].district='unknown',
    m=>m.locations[0].region='unknown',
    m=>m.districts[0].region='unknown',
    m=>m.locations[0].overrides={name:''},
    m=>m.locations[0].name='Misplaced override',
    m=>m.image='https://example.com/remote.webp',
    m=>m.thumbnail='../outside.webp',
    m=>m.tags={},
    m=>delete m.districts,
    m=>delete m.generator
  ];
  for(const change of variants) {const m=makeMap();change(m);assert.throws(()=>validateMap(m),undefined,String(change));}
});
test('custom location types generate useful text in their assigned viewer category',()=>{
  const map=makeMap();
  map.generator.catalog={types:{observatory:{category:'landmark',label:'observatory',nouns:['Lens'],roles:['astronomer'],services:['star charts'],tables:{description:['{fullName} offers {service} in {district}.']}}}};
  Object.assign(map.locations[0],{category:'landmark',type:'observatory'});
  validateMap(map);assert.match(output(map).description,/offers star charts in Old Town/);
});
test('custom content sections can be enabled, overridden, searched and rendered without viewer edits',()=>{
  const map=makeMap();
  map.generator.catalog={sections:{hours:{label:'Opening hours',templates:['Dawn to dusk in {district}.']},stock:{label:'In stock',templates:['{service}']}}};
  map.generator.defaults={fields:['name','hours','stock']};validateMap(map);
  let p=resolveLocation(map,map.locations[0]);
  assert.deepEqual(p.extra.hours,{label:'Opening hours',text:'Dawn to dusk in Old Town.'});
  assert.equal(p.person,'');assert.equal(matches(p,{query:'dawn to dusk'}),true);
  assert.match(detailHTML(p),/Opening hours/);
  map.locations[0].overrides={hours:'<b>Closed</b>'};validateMap(map);
  p=resolveLocation(map,map.locations[0]);assert.match(detailHTML(p),/&lt;b&gt;Closed/);
  map.generator.defaults.fields=['name'];delete map.locations[0].overrides;
  assert.equal(resolveLocation(map,map.locations[0]).extra.hours.text,'');
  map.generator.catalog.sections.hours.templates=['{badToken}'];assert.throws(()=>validateMap(map),/token/);
});
test('legacy conversion preserves authored text, identifiers, shapes and dimensions',()=>{
  const old=makeMap();delete old.schemaVersion;delete old.generator;delete old.regions;
  old.districts=['Old Town'];Object.assign(old.locations[0],{name:'Old Shop',description:'Original story',district:'Old Town',person:'Pat',featured:true});delete old.locations[0].type;
  const migrated=migrateMap(old);validateMap(migrated);
  assert.equal(materializeMap(migrated).locations[0].description,'Original story');
  assert.equal(migrated.locations[0].id,old.locations[0].id);assert.deepEqual(migrated.locations[0].bounds,old.locations[0].bounds);
  assert.equal(migrated.locations[0].description,undefined);assert.equal(old.locations[0].description,'Original story');
  const regen=migrateMap({...old,locations:[{...old.locations[0],featured:false}]},{regenerateUnfeatured:true});
  assert.equal(regen.locations[0].overrides,undefined);
  assert.equal(migrateMap(old,{regenerateUnfeatured:true}).locations[0].overrides.description,'Original story');
  assert.deepEqual(JSON.parse(serializeMap(migrated)),migrated);
});
test('draft saving stores only inputs, rejects collisions and preserves existing ids',()=>{
  const published=makeMap(),added=newLocation(published,40,40);
  const draft=saveLocation(published,added);
  validateMap(draft);assert.equal(published.locations.length,1);assert.equal(draft.locations.length,2);
  assert.equal(added.name,undefined);assert.throws(()=>saveLocation(draft,added),/already/);
  assert.throws(()=>saveLocation(draft,{...added,id:'changed'},added.id),/cannot be changed/);
  const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  writeDraft(draft,published,storage);assert.equal(readDraft(published,storage).local,true);
  assert.equal(readDraft({...published,subtitle:'New published revision'},storage).stale.id,published.id);
  const saved=JSON.parse([...data.values()][0]);assert.equal(saved.map.locations[1].name,undefined);
  clearDraft(published.id,storage);assert.equal(readDraft(published,storage).local,undefined);
  const broken={getItem:()=>'{broken'};assert.equal(readDraft(published,broken).unavailable,true);
  assert.throws(()=>writeDraft(draft,published,{setItem:()=>{throw new Error('Quota exceeded');}}),/storage/);
});
test('ellipse and polygon hit shapes survive serialization and search uses generated demographics',()=>{
  const map=makeMap(),p=map.locations[0];delete p.bounds;
  p.shape={kind:'ellipse',rx:10,ry:5};validateMap(map);
  let places=materializeMap(map).locations,index=buildSpatialIndex(places);
  assert.equal(hitTest(index,places,39,24),null);assert.equal(hitTest(index,places,30,24)?.id,p.id);
  p.shape={kind:'polygon',points:[[25,15],[35,15],[25,25]]};validateMap(map);
  places=materializeMap(map).locations;index=buildSpatialIndex(places);
  assert.equal(hitTest(index,places,34,24),null);assert.equal(hitTest(index,places,26,16)?.id,p.id);
  p.generation={demographics:{race:'elf'}};
  const resolved=resolveLocation(map,p);assert.equal(matches(resolved,{query:'elf'}),true);
  assert.equal(matches(resolved,{query:resolved.name,district:'Old Town',category:'shop'}),true);
});
test('generated templates and authored overrides are escaped in every text surface',()=>{
  const map=makeMap();map.locations[0].overrides={name:'<img src=x>',services:'<script>x</script>',description:'<b>test</b>'};
  const p=resolveLocation(map,map.locations[0]);
  for(const html of [detailHTML(p),tooltipHTML(p)]) {assert.doesNotMatch(html,/<img src=x>/);assert.match(html,/&lt;img/);}
  assert.match(detailHTML(p),/&lt;script&gt;/);
});
test('full-text search yields and cancels when a query is replaced or the viewer closes',async()=>{
  const p=output(makeMap()),places=Array.from({length:5},(_,i)=>({...p,id:'test-'+i}));
  let current=true;
  const pending=searchPlaces(places,{query:p.name},{batchSize:1,current:()=>current});
  current=false;assert.equal(await pending,null);
  const controller=new AbortController();controller.abort();
  assert.equal(await searchPlaces(places,{query:p.name},{signal:controller.signal}),null);
  assert.equal((await searchPlaces(places,{query:'test-2'},{batchSize:2})).length,1);
});
test('the complete migrated map resolves without missing text or unresolved tokens',async()=>{
  const source=JSON.parse(await readFile(new URL('../public/data/maps/dragonsgate.json',import.meta.url),'utf8'));
  validateMap(source);
  assert.equal(source.locations.length,7085);assert.equal(source.locations.filter(p=>p.overrides).length,54);
  const places=materializeMap(source).locations;
  for(const p of places) {
    for(const field of ['name','description','person','rumor','address','services']) {
      assert.equal(typeof p[field],'string');assert.doesNotMatch(p[field],/undefined|\{\w+\}/);
    }
  }
  assert.equal(places[0].name,'The Dragonseat');
  assert.equal(places[0].description,source.locations[0].overrides.description);
  // Pin released v1 output so later refactors cannot silently reroll this map.
  assert.equal(places[54].name,'Tabitha’s Rooms on Garden Walk');
  assert.equal(places[54].person,'Tabitha Dunbar, adult human resident. She knows the neighbors by name.');
  assert.ok(source.locations.filter(p=>p.type).length>2000);
  assert.ok(Buffer.byteLength(serializeMap(source))<850000);
});
