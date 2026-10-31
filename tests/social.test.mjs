import { compatibleProducts } from '../public/js/generation/social/goods.js';
import { tradeCatalog } from '../public/js/generation/economy-catalog.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { socialGraph, residentAt, householdAt, storiesAt } from '../public/js/generation/social/index.js';
import { socialSources, recipeTokens, scenarios } from '../public/js/generation/social/sources.js';
import { householdTypes } from '../public/js/generation/social/household-types.js';
import { baseIdentity } from '../public/js/generation/social/identity.js';
import { socialEnabled } from '../public/js/generation/social/sections.js';
import { configFor, catalogFor, availableFields } from '../public/js/generation/config.js';
import { resolveLocation, materializeMap } from '../public/js/generation/locations.js';
import { applySettings } from '../public/js/generation/settlement-settings.js';
import { ancestries } from '../public/js/generation/settlement-pools-v1.js';
import { validateMap } from '../public/js/map-contract.js';
import { serializeMap } from '../public/js/authoring/model.js';
import { streams } from '../public/js/generation/helpers-v2.js';
import { uniqueChoices } from '../public/js/generation/detail-helpers-v1.js';
import { render } from '../public/js/generation/random.js';
import { detailHTML } from '../public/js/places.js';
import { guideEntryHTML } from '../public/js/guide-entry.js';
import { entrySections } from '../public/js/site-index.js';
import { matches } from '../public/js/spatial.js';
import { socialForm, readSocial, removeSocialReference } from '../public/js/authoring/social-form.js';
const place=(id,type,category=type)=>({id,type,category,district:'ward',x:30,y:40});
const makeMap=()=>({schemaVersion:2,id:'community',name:'Test',subtitle:'Test town',description:'Test town',theme:'Fantasy',region:'Region',image:'map.webp',thumbnail:'thumb.webp',width:100,height:100,
  generator:{version:2,socialVersion:1,seed:'world',defaults:{settlement:{type:'town'},demographics:{race:'human',gender:'nonbinary',age:'adult',wealth:'comfortable'}}},
  districts:[{id:'ward',name:'Ward'}],locations:[
    {...place('home-a','home'),generation:{demographics:{population:3},social:{householdStyle:'extended_family',workplace:'cooper'}}},
    {...place('home-b','home'),generation:{demographics:{population:2},social:{householdStyle:'partners',workplace:'inn'}}},
    place('cooper','cooper','workshop'),place('inn','tavern'),place('road','road','street'),place('river','river','water')
  ]});
const lookup=m=>new Map(materializeMap(m).locations.map(p=>[p.id,p]));
const snapshot=p=>JSON.parse(JSON.stringify(p));
test('social lexical and narrative banks have 100 distinct reachable variations in a fixed context',()=>{
  const tokens=Object.fromEntries(recipeTokens.map(k=>[k,`example-${k}`]));
  assert.ok(Object.keys(scenarios).length>=16);assert.equal(Object.keys(householdTypes).length,10);
  for(const [key,values] of Object.entries(socialSources)) {
    assert.ok(values.length>=100,key);assert.equal(new Set(values).size,values.length,key);
    const expanded=values.map(v=>render(v,tokens));assert.equal(new Set(expanded).size,values.length,key);
    assert.ok(expanded.every(v=>!/[{}]/.test(v)),key);
    const selected=new Set(Array.from({length:1400},(_,i)=>uniqueChoices(values,1,streams([key,i])('draw'))[0]));
    assert.ok(selected.size>=100,key);
  }
});
test('all naming traditions share the same resident identity, occupation, habits and residence between sites',()=>{
  for(const ancestry of Object.keys(ancestries)) {
    const m=applySettings(makeMap(),{ancestry,seed:'all-races'});validateMap(m);const p=lookup(m);
    const home=p.get('home-a'),work=p.get('cooper'),head=home.community.residents[0],keeper=work.community.residents[0];
    assert.equal(head.id,keeper.id);assert.equal(head.name,keeper.name);assert.equal(head.race,ancestry);
    assert.equal(head.occupation,'cooper');assert.equal(keeper.homeId,'home-a');assert.equal(head.workplaceId,'cooper');
    assert.ok(home.person.includes(head.name));assert.ok(work.person.includes(head.name));
    assert.equal(home.person.split('Known for ')[1],work.person.split('Known for ')[1]);
    assert.ok(work.extra.commissions.text.includes(head.name));assert.ok(home.extra.household.text.includes(head.name));
    assert.ok(home.community.residents.every(r=>r.race===ancestry));
    assert.equal(home.demographics.population,3);assert.equal(home.community.residents.length,3);
    assert.equal(residentAt(m,'cooper').id,head.id);assert.equal(householdAt(m,'home-a').count,3);
    for(const site of p.values())for(const value of [site.name,site.description,site.person,site.rumor,...Object.values(site.extra).map(v=>v.text)])assert.doesNotMatch(value,/undefined|\{\w+\}|\.\./,`${ancestry} ${site.id}`);
  }
});
test('both ends of every situation share the same facts, actors, state, amount and request',()=>{
  for(let seed=0;seed<20;seed++) {
    const m=makeMap();m.generator.seed=seed;const p=lookup(m),g=socialGraph(m);
    for(const link of g.links.values()) {
      const a=p.get(link.from).community.stories.find(s=>s.id===link.id),b=p.get(link.to).community.stories.find(s=>s.id===link.id);
      assert.ok(a && b);assert.notEqual(link.supplierId,link.buyerId);
      for(const key of ['fact','goal','request','product','state','amount','supplierId','buyerId','requesterId'])assert.deepEqual(a[key],b[key],key);
      assert.ok(a.rumor.includes(a.fact));assert.ok(b.rumor.includes(a.fact));
      assert.equal(g.people.get(link.supplierId).id,a.supplierId);
      if(a.scenario==='invoice'){assert.equal(a.state,'delivered_unpaid');assert.ok(a.fact.includes(`${a.amount} sp`));}
      assert.ok(p.get(link.from).community.related.some(r=>r.id===link.to));assert.ok(p.get(link.to).community.related.some(r=>r.id===link.from));
    }
    assert.equal(storiesAt(m,'cooper').length,p.get('cooper').community.stories.length);
  }
});
test('population, household structures, dependents and care roles constrain workplace matching',()=>{
  for(const [style,t] of Object.entries(householdTypes)) {
    const m=makeMap();m.locations=[{...place('home','home'),generation:{demographics:{population:t.min},social:{householdStyle:style}}},place('shop','shop')];validateMap(m);
    const home=resolveLocation(m,m.locations[0]);assert.equal(home.community.household.style,style);assert.equal(home.community.residents.length,t.min);
    for(const r of home.community.residents)if(['child','infant','adolescent'].includes(r.age) || r.role==='relative receiving support')assert.equal(r.workplaceId,null);
  }
  for(const count of [0,1,2,40]) {
    const m=makeMap();m.locations=[{...place('home','home'),generation:{demographics:{population:count}}},place('shop','shop')];validateMap(m);
    const r=resolveLocation(m,m.locations[0]);assert.equal(r.community.household.count,count);assert.equal(r.community.residents.length,Math.min(12,count));
    if(count===0){assert.equal(r.person,'');assert.equal(r.community.stories.length,0);assert.match(r.extra.household.text,/No permanent residents/);}
    if(count===40)assert.match(r.extra.household.text,/28 additional residents/);
  }
  const m=makeMap();m.locations=[{...place('child-home','home'),generation:{demographics:{age:'child',population:2}}},place('work','shop')];validateMap(m);
  const r=resolveLocation(m,m.locations[0]);assert.equal(r.community.household.style,'guardian_dependents');assert.equal(r.community.residents[0].workplaceId,null);assert.doesNotMatch(r.person,/merchant|smith|cooper/);
});
test('structural passes do not read name pools or prose, and no full location is resolved recursively',()=>{
  const m=makeMap();let reads=0;
  const pool=new Proxy({female:['Ada'],male:['Ben'],nonbinary:['Ren'],surnames:['Oak']},{get(target,key){reads++;return target[key];}});
  m.generator.catalog={people:{human:pool}};
  const g=socialGraph(m);assert.ok(g.links.size);assert.equal(reads,0);
  const r=resolveLocation(m,m.locations[2]);assert.ok(r.name);assert.ok(reads>0);
});
test('generation is independent of view order, unrelated geography, geometry and enabled fields',()=>{
  const m=makeMap(),before=lookup(m),copy=structuredClone(m);copy.locations.reverse();copy.locations[0].x=70;copy.locations.push(place('pond','pond','water'));
  for(const p of lookup(copy).values())if(before.has(p.id)) {
    const old=before.get(p.id);for(const key of ['name','person','rumor','extra','community'])assert.deepEqual(p[key],old[key],p.id+' '+key);
  }
  const partial=structuredClone(m);partial.locations[2].generation={fields:['name','person','requests']};
  const r=resolveLocation(partial,partial.locations[2]);assert.equal(r.person,before.get('cooper').person);assert.equal(r.extra.requests.text,before.get('cooper').extra.requests.text);assert.equal(r.extra.connections.text,'');
  const json=serializeMap(m),round=JSON.parse(json);assert.equal(round.locations[0].community,undefined);assert.equal(round.locations[0].generation.social.workplace,'cooper');
  assert.deepEqual(snapshot(resolveLocation(round,round.locations[2])),{...snapshot(before.get('cooper')),siteNumber:round.locations[2].siteNumber});
  const varied=structuredClone(m);varied.generator.seed='different';assert.notEqual(resolveLocation(varied,varied.locations[0]).community.residents[0].name,before.get('home-a').community.residents[0].name);
});
test('authored profiles remain literal and opaque contacts do not acquire invented resident identities',()=>{
  const m=makeMap();delete m.locations[0].generation.social.workplace;m.locations[2].overrides={name:'Written Cooper',person:'Neri, a retired craftsperson',rumor:'Authored rumor'};validateMap(m);
  const r=resolveLocation(m,m.locations[2]);assert.equal(r.person,'Neri, a retired craftsperson');assert.equal(r.rumor,'Authored rumor');assert.equal(r.community.residents[0].name,'the keeper of Written Cooper');assert.equal(r.community.residents[0].homeId,null);
  m.locations[0].generation.social.workplace='cooper';assert.throws(()=>validateMap(m),/incompatible|opaque|slot/);
  m.locations[0].generation.social.personName='Neri';m.locations[0].overrides={person:'Neri, a retired craftsperson'};delete m.locations[2].overrides.person;
  validateMap(m);assert.equal(resolveLocation(m,m.locations[2]).community.residents[0].name,'Neri');
});
test('invalid references, impossible capacity, conflicting homes and malformed social sources fail validation',()=>{
  const invalid=[
    m=>m.generator.socialVersion=9,m=>m.locations[2].generation={social:{home:'missing'}},m=>m.locations[2].generation={social:{home:'inn'}},
    m=>m.locations[0].generation.demographics.population=0,m=>m.locations[1].generation.social.workplace='cooper',
    m=>m.locations[2].generation={social:{home:'home-b'}},m=>m.locations[0].generation.social.householdStyle='partners',
    m=>m.locations[0].generation.social.householdStyle='unknown',m=>m.generator.defaults.social={home:'home-a'},
    m=>m.generator.catalog={socialRecipes:{rumor:['one']}},m=>m.generator.defaults.tables={name:['{residentNote}']}
  ];
  for(const change of invalid){const m=makeMap();change(m);assert.throws(()=>validateMap(m));}
  const m=makeMap();m.generator.catalog={socialRecipes:{household_extended_family:Array.from({length:100},(_,i)=>({value:`Only elven family ${i}`,when:{races:['elf']}}))}};assert.throws(()=>validateMap(m),/100 matching/);
});
test('mixed ancestry and custom naming cultures use the supplied pools for household members',()=>{
  const m=makeMap();m.locations=[{...place('home','home'),generation:{demographics:{population:8},social:{householdStyle:'shared_lodging'}}}];
  m.generator.defaults.demographics={races:{elf:1,orc:1},culture:'local',gender:'nonbinary',age:'adult',wealth:'modest'};
  m.generator.catalog={people:{local:{female:['Ada'],male:['Ben'],nonbinary:['Ren'],surnames:['Oak']}},cultures:{local:{namePool:'local'}}};validateMap(m);
  const r=resolveLocation(m,m.locations[0]);assert.ok(r.community.residents.every(p=>/^(Ada|Ben|Ren) Oak$/.test(p.name)));assert.ok(r.community.residents.every(p=>p.culture==='local'));
  assert.ok(new Set(r.community.residents.map(p=>p.race)).size>1);
});
test('social prose and linked navigation reach search, callouts, site guides and compact authoring controls safely',()=>{
  const m=makeMap();m.locations[0].overrides={name:'<img src=x> Home'};const work=resolveLocation(m,m.locations[2]),home=resolveLocation(m,m.locations[0]);
  assert.ok(matches(work,{query:home.community.residents[0].name}));assert.ok(entrySections(work).some(([label])=>label==='Requests and leads'));
  for(const html of [detailHTML(work),guideEntryHTML(work,1,m)]){assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img src=x/);assert.match(html,/Connected places/);}
  assert.match(detailHTML(work),/data-place="home-a"/);assert.match(guideEntryHTML(work,1,m),/data-site="home-a"/);
  const form=socialForm(m,m.locations[0]);assert.match(form,/Household structure/);assert.match(form,/Shared name/);
  const data=new FormData();data.set('socialEnabled','yes');data.set('social-workplace','cooper');data.set('householdStyle','extended_family');data.set('socialPersonName','Shared Name');
  const generation={};readSocial(data,generation,m.locations[0]);assert.equal(generation.social.workplace,'cooper');assert.equal(generation.social.personName,'Shared Name');
  const p={generation};removeSocialReference(p,'cooper');assert.equal(p.generation.social.workplace,undefined);
});
test('both engines can opt into shared data without changing snapshots that do not opt in',()=>{
  const old=makeMap();delete old.generator.socialVersion;const before=snapshot(resolveLocation(old,old.locations[2]));assert.equal(before.community,undefined);assert.equal(socialEnabled(old),false);
  const m=makeMap();m.generator.version=1;for(const place of m.locations.filter(p=>['street','water'].includes(p.category)))place.generation={version:2};validateMap(m);const p=lookup(m);assert.equal(p.get('cooper').community.residents[0].id,p.get('home-a').community.residents[0].id);assert.ok(p.get('cooper').person.includes(p.get('home-a').community.residents[0].name));
  assert.deepEqual(snapshot(resolveLocation(old,old.locations[2])),before);
});

test('an explicitly named authored keeper keeps that name when assigned a residence',()=>{
  const m=makeMap();delete m.locations[0].generation.social.workplace;
  m.locations[2].generation={social:{personName:'Neri Voss',home:'home-a'}};m.locations[2].overrides={person:'Neri Voss, a cooper'};
  validateMap(m);const p=lookup(m),keeper=p.get('cooper').community.residents[0];
  assert.equal(keeper.name,'Neri Voss');assert.equal(keeper.homeId,'home-a');
  assert.ok(p.get('home-a').community.residents.some(r=>r.name==='Neri Voss' && r.id===keeper.id));
  assert.ok(p.get('cooper').extra.commissions.text.includes('the keeper'));
});

test('resident recipe conditions use the shared person’s actual workplace trade',()=>{
  const m=makeMap();m.locations=[{...place('home','home'),generation:{demographics:{population:1},social:{workplace:'cooper'}}},place('cooper','cooper','workshop')];
  m.generator.catalog={socialRecipes:{residentHabits:Array.from({length:100},(_,i)=>({value:`keeps cooper reference ${i}`,when:{trades:['cooper']}}))}};
  validateMap(m);const p=lookup(m);assert.match(p.get('home').extra.residents.text,/keeping cooper reference/);assert.match(p.get('cooper').person,/keeping cooper reference/);
});

test('every household structure resolves through all eleven built-in traditions',()=>{
  for(const ancestry of Object.keys(ancestries))for(const [style,type] of Object.entries(householdTypes)) {
    const source=makeMap();source.locations=[{...place('home','home'),generation:{demographics:{population:Math.max(type.min,type.max || 5)},social:{householdStyle:style}}}];
    const map=applySettings(source,{ancestry,seed:'household-traditions'});validateMap(map);
    const p=resolveLocation(map,map.locations[0]);assert.equal(p.community.household.style,style);assert.ok(p.community.residents.every(r=>r.race===ancestry));
    assert.equal(new Set(p.community.residents.map(r=>r.name)).size,p.community.residents.length);
  }
});
test('creative situations respect trade workflows and link only existing actors and locations',()=>{
  const seen=new Set();
  for(let seed=0;seed<35;seed++) {
    const m=makeMap();m.generator.seed=seed;
    m.locations=[...Array.from({length:12},(_,i)=>({...place(`home-${i}`,'home'),generation:{demographics:{population:2}}})),
      place('cooper','cooper','workshop'),place('inn','tavern'),place('enchanter','enchanter','workshop'),place('component','component_merchant','shop'),place('boatbuilder','boatbuilder','workshop'),place('scribe','scribe','shop'),
      {...place('chartmaker','chartmaker','workshop'),context:{street:'road'}},place('road','road','street')];
    const graph=socialGraph(m);
    for(const link of graph.links.values()) {
      seen.add(link.scenario);assert.ok(graph.people.has(link.supplierId));assert.ok(graph.people.has(link.buyerId));
      if(link.scenario==='whispering_work')assert.equal(graph.facts.get(link.from).economy().trade.industry,'arcane');
      if(link.scenario==='map_clue')assert.equal(graph.facts.get(link.from).place.context.street,'road');
      if(link.scenario==='damaged')assert.notEqual(graph.facts.get(link.from).economy().trade.id,'scribe');
      if(link.scenario==='pet')assert.equal(link.kind,'neighbors');
    }
  }
  for(const scenario of ['pet','heirloom','festival','whispering_work','map_clue','makers_mark'])assert.ok(seen.has(scenario),scenario);
});

test('shared orders filter actual products as well as supplier industries',()=>{
  const m=makeMap(),graph=socialGraph(m),inn=graph.facts.get('inn');
  const goods=compatibleProducts(tradeCatalog.blacksmith,inn);assert.ok(goods.length);assert.ok(goods.every(v=>!/horseshoe|sword|arrow|helmet|saddle/i.test(v)));
  for(const link of graph.links.values())if(link.kind==='trade')assert.ok(compatibleProducts(tradeCatalog[link.tradeId],graph.facts.get(link.to)).includes(link.product));
});
