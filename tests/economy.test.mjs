import { economicDetails, economicHistory } from '../public/js/generation/economy-prose.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { newTrades } from '../public/js/generation/economy-trades.js';
import { tradeCatalog, tradeStockRecipes, industryRecipes, industries } from '../public/js/generation/economy-catalog.js';
import { workRecipes, workRumors } from '../public/js/generation/economy-workflows.js';
import { budgetRecipes } from '../public/js/generation/economy-budgets.js';
import { traditionRecipes } from '../public/js/generation/economy-traditions.js';
import { demandRecipes, guestRecipes, supplyRecipes } from '../public/js/generation/economy-recipes.js';
import { economicContext, tradeChoices, scoreTrade } from '../public/js/generation/economy-context.js';
import { settlementTypes } from '../public/js/generation/economy-settlements.js';
import { configFor, availableFields } from '../public/js/generation/config.js';
import { resolveLocation, materializeMap } from '../public/js/generation/locations.js';
import { applySettings, settingsURL, readSettings, saveSettings, normalizeSettings } from '../public/js/generation/settlement-settings.js';
import { ancestries } from '../public/js/generation/settlement-pools-v1.js';
import { validateMap } from '../public/js/map-contract.js';
import { serializeMap } from '../public/js/authoring/model.js';
import { placeForm, typeOptions } from '../public/js/authoring/forms.js';
import { matches } from '../public/js/spatial.js';
import { detailHTML } from '../public/js/places.js';
import { guideEntryHTML } from '../public/js/guide-entry.js';
import { render } from '../public/js/generation/random.js';
import { streams } from '../public/js/generation/helpers-v2.js';
import { uniqueChoices } from '../public/js/generation/detail-helpers-v1.js';
const place=(id,type='shop',category=tradeCatalog[type]?.category || type)=>({id,type,category,district:'ward',x:30,y:40});
const makeMap=()=>({schemaVersion:2,id:'economy',name:'Test',subtitle:'Test town',description:'Test town',theme:'Fantasy',region:'Test region',image:'map.webp',thumbnail:'thumb.webp',width:100,height:100,
  generator:{version:2,seed:'world',defaults:{demographics:{race:'human',gender:'nonbinary',wealth:'comfortable'},settlement:{type:'town'}}},districts:[{id:'ward',name:'Ward'}],locations:[place('shop')]});
function debugMap(map) {
  map.generator.catalog={...map.generator.catalog,sections:{facts:{label:'Facts',templates:['{trade}|{tradeRole}|{product}|{material}|{customer}|{settlementType}|{industry}|{supplyRoute}|{tradition}']}}};
  map.generator.defaults.fields=[...availableFields(map)];return map;
}
const snapshot=p=>{const {siteNumber,...content}=JSON.parse(JSON.stringify(p));return content;};
test('catalog adds substantive trades and every compiled recipe has 100 attainable variations',()=>{
  assert.ok(Object.keys(newTrades).length>=80);assert.equal(Object.keys(industries).length,18);
  const banks={...tradeStockRecipes,...traditionRecipes,...demandRecipes,...guestRecipes,...workRecipes,...workRumors,...budgetRecipes,supply:supplyRecipes,economicDetails,economicHistory};
  for(const [id,p] of Object.entries(industryRecipes))for(const [k,v] of Object.entries(p))banks[`${id}.${k}`]=v;
  const tokens={displayName:'Sample',product:'linen cloth',customer:'local households',trade:'weaver',material:'flax',supplyRoute:'River Road',district:'Ward',industry:'textiles',settlementType:'town'};
  for(const [key,values] of Object.entries(banks)) {
    assert.ok(values.length>=100,key);assert.equal(new Set(values).size,values.length,key);
    const rendered=values.map(v=>render(v,tokens));assert.equal(new Set(rendered).size,values.length,key);
    assert.ok(rendered.every(v=>!/[{}]/.test(v)),key);
    const selected=new Set(Array.from({length:1200},(_,i)=>uniqueChoices(values,1,streams([key,i])('draw'))[0]));
    assert.ok(selected.size>=100,key);
  }
  assert.deepEqual(Object.keys(traditionRecipes).sort(),Object.keys(ancestries).sort());
  for(const t of Object.values(newTrades))assert.ok(new Set(t.items).size>=10,t.label);
});
test('every ancestry supports every new trade with matching practitioner, goods and commission',()=>{
  for(const ancestry of Object.keys(ancestries)) {
    const source=debugMap(makeMap());source.generator.defaults.settlement={type:'port'};
    source.locations=Object.entries(newTrades).map(([id,t])=>place(id.replaceAll('_','-'),id,t.category));
    const m=applySettings(source,{ancestry,seed:'all-trades'});validateMap(m);
    for(const p of materializeMap(m).locations) {
      const t=tradeCatalog[p.type],facts=p.extra.facts.text.split('|'),product=facts[2];
      assert.equal(p.demographics.race,ancestry);assert.ok(p.person.includes(t.role),`${ancestry} ${p.type}`);
      for(const text of [p.name,p.description,p.person,p.rumor,...Object.values(p.extra).map(v=>v.text)])assert.doesNotMatch(text,/undefined|null|[{}]|\.\./,p.type);
      if(['shop','workshop'].includes(p.category)) {
        assert.ok(p.services.includes(product));assert.ok(p.extra.commissions.text.includes(product));
        assert.ok(p.extra.stock.text.toLowerCase().includes(product.toLowerCase()));
        assert.ok(p.extra.craftTradition.text.includes(p.name));
      }
    }
  }
});
test('settlement, geography, resources and wealth affect eligible trades and weights',()=>{
  const map=makeMap(),p=map.locations[0],config=configFor(map,p).config;
  const base=economicContext(map,p,config,{wealth:'comfortable'});
  assert.ok(tradeChoices(base).every(t=>tradeCatalog[t.value].industry!=='maritime'));
  map.locations.push(place('pond','pond','water'));p.context={water:'pond'};
  assert.ok(tradeChoices(economicContext(map,p,config)).every(t=>tradeCatalog[t.value].industry!=='maritime'));
  map.locations[1].type='river';
  const river=economicContext({...map},p,config);
  assert.ok(tradeChoices(river).some(t=>t.value==='shipwright'));
  const forest={...base,resources:['timber'],environment:['woodland'],industries:['wood']};
  assert.ok(scoreTrade(tradeCatalog.carpenter,forest)>scoreTrade(tradeCatalog.carpenter,base)*5);
  assert.ok(scoreTrade(tradeCatalog.jeweler,{...base,wealth:'wealthy'})>scoreTrade(tradeCatalog.jeweler,{...base,wealth:'modest'}));
  for(const type of Object.keys(settlementTypes)) {
    const m=debugMap(makeMap());m.generator.defaults.settlement={type};validateMap(m);
    const r=resolveLocation(m,m.locations[0]);assert.equal(r.extra.facts.text.split('|')[5],settlementTypes[type].label);
  }
});
test('geographic links, local supplies, budget and custom cultures remain coherent',()=>{
  const m=debugMap(makeMap());m.locations=[place('translator','translator'),place('road','road','street'),place('river','river','water'),place('wood','wood','terrain')];
  m.locations[0].context={street:'road',water:'river',terrain:'wood'};
  m.locations[1].overrides={name:'Written Road'};m.locations[2].overrides={name:'Written River'};
  m.generator.defaults.settlement={type:'academy',resources:['paper','herbs','timber']};
  m.generator.catalog.cultures={guild:{namePool:'elf'}};m.generator.defaults.demographics.culture='guild';
  const r=resolveLocation(m,m.locations[0]),facts=r.extra.facts.text.split('|');
  assert.ok(['Written Road','Written River'].includes(facts[7]));assert.ok(r.address.includes('Written Road'));
  assert.equal(facts[8],'elf');assert.ok(r.extra.tradeLinks.text.includes(facts[7]));
  const local=['paper'].includes(facts[3]);assert.equal(r.extra.tradeLinks.text.includes('A local source is recorded'),local);
  assert.ok(r.extra.commissions.text.includes(facts[2]));assert.doesNotMatch(r.extra.commissions.text,/weigh|moor|hull|forge/i);
  m.generator.defaults.demographics.wealth='wealthy';
  assert.match(resolveLocation({...m},m.locations[0]).extra.commissions.text,/custom specification|presentation copy|dedicated collection|decorative finish|separately packed|provenance record|signed sample|commissioned design|production slot|personalized presentation/);
});
test('new content is deterministic across enabled fields, serialization, ordering and unrelated geometry',()=>{
  const m=debugMap(makeMap()),before=serializeMap(m),first=snapshot(resolveLocation(m,m.locations[0]));
  assert.deepEqual(snapshot(resolveLocation(JSON.parse(before),JSON.parse(before).locations[0])),first);
  const n=structuredClone(m);n.locations[0].x=80;n.locations.push(place('other'));n.locations.reverse();
  const next=resolveLocation(n,n.locations[1]);
  for(const key of ['name','person','description','rumor','services','extra'])assert.deepEqual(next[key],first[key]);
  n.locations[1].generation={fields:['name','stock','commissions','tradeLinks']};
  const partial=resolveLocation({...n},n.locations[1]);
  for(const key of ['stock','commissions','tradeLinks'])assert.equal(partial.extra[key].text,first.extra[key].text);
  assert.equal(serializeMap(m),before);
  const varied=structuredClone(m);varied.locations[0].generation={revision:1};
  assert.notEqual(resolveLocation(varied,varied.locations[0]).extra.facts.text,first.extra.facts.text);
});
test('authored types, text, empty households and new output consumers preserve their meanings',()=>{
  const m=makeMap();m.locations=[place('custom','custom','shop'),place('empty','home')];
  m.generator.catalog={types:{custom:{category:'shop',label:'binding broker',nouns:['Ledger'],roles:['binding broker'],services:['bookbinding appointments']}}};
  m.locations[0].overrides={craftTradition:'<img src=x> special-maker-mark'};
  m.locations[1].generation={demographics:{population:0}};
  validateMap(m);const r=resolveLocation(m,m.locations[0]);
  assert.match(r.services,/bookbinding appointments/);assert.doesNotMatch(r.extra.stock.text,/fish|swords|hides/);
  assert.ok(matches(r,{query:'special-maker-mark'}));
  for(const html of [detailHTML(r),guideEntryHTML(r,1,m)]){assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img src=x/);}
  assert.equal(resolveLocation(m,m.locations[1]).person,'');assert.match(resolveLocation(m,m.locations[1]).extra.livelihood.text,/No resident/);
  for(const category of ['shop','workshop','tavern'])assert.ok(typeOptions(m,category).includes(category==='shop'?'translator':category==='workshop'?'shipwright':'teahouse'));
  const form=placeForm(m,m.locations[0],false);assert.match(form,/Local economy/);assert.match(form,/mining_outpost/);
});
test('settlement context inherits property by property and rejects malformed settings',()=>{
  const m=makeMap();m.generator.defaults.settlement={type:'town',resources:['timber'],industries:['wood']};
  m.regions=[{id:'region',name:'Region',generation:{settlement:{environment:['woodland']}}}];m.districts[0].region='region';
  m.districts[0].generation={settlement:{industries:['medicine']}};m.locations[0].generation={settlement:{type:'hamlet'}};
  assert.deepEqual(configFor(m,m.locations[0]).config.settlement,{type:'hamlet',resources:['timber'],industries:['medicine'],environment:['woodland']});validateMap(m);
  for(const value of [{type:'unknown'},{resources:['gold-plated-trees']},{resources:'timber'},{industries:['unknown']},{environment:['unknown']},{typo:1}]) {
    const bad=makeMap();bad.generator.defaults.settlement=value;assert.throws(()=>validateMap(bad));
  }
});
test('conditional detail banks validate every possible race and culture with economic context',()=>{
  const m=makeMap();m.locations=[place('book','scribe')];m.generator.defaults.demographics={races:{human:1,elf:1},wealth:'comfortable',culture:'ancestral'};
  m.generator.defaults.settlement={type:'academy',resources:['paper'],environment:['woodland']};
  const make=(race,count=100)=>Array.from({length:count},(_,i)=>({value:`${race} document ${i} for {product}`,when:{races:[race],cultures:['ancestral'],settlements:['academy'],industries:['records'],resources:['paper'],environments:['woodland']}}));
  m.generator.catalog={detailSources:{stock_scribe:[...make('human'),...make('elf')]}};validateMap(m);
  const r=resolveLocation(m,m.locations[0]);assert.match(r.extra.stock.text,new RegExp(r.demographics.race+' document'));
  const broken=structuredClone(m);broken.generator.catalog.detailSources.stock_scribe.pop();assert.throws(()=>validateMap(broken),/100 matching/);
  const bad=structuredClone(m);bad.generator.catalog.detailSources.stock_scribe[0].when.environments='woodland';assert.throws(()=>validateMap(bad));
});
test('settlement choices round trip through shared URLs and local settings without mutating source maps',()=>{
  const m=makeMap(),before=serializeMap(m),choice={ancestry:'original',seed:'new-seed',settlementType:'mining_outpost'};
  const url=settingsURL('https://example.test/#map/economy/shop',choice);
  assert.deepEqual(readSettings(m,url,{getItem:()=>null}),choice);
  const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  assert.equal(saveSettings(m,choice,storage),true);assert.deepEqual(readSettings(m,'https://example.test/',storage),choice);
  const applied=applySettings(m,choice);validateMap(applied);assert.equal(configFor(applied,applied.locations[0]).config.settlement.type,'mining_outpost');
  assert.equal(applied.locations[0].generation.demographics,undefined);assert.equal(serializeMap(m),before);
  assert.throws(()=>normalizeSettings(m,{settlementType:'unknown'}));
  assert.equal(settingsURL(url,{ancestry:'human',seed:'original'}).searchParams.has('settlement'),false);
});
test('published map districts declare local economic focuses and expose new sections',async()=>{
  for(const id of ['dragonsgate','grayhaven']) {
    const m=JSON.parse(await readFile(new URL(`../public/data/maps/${id}.json`,import.meta.url)));
    assert.ok(m.districts.every(d=>d.generation?.settlement?.industries.length));validateMap(m);
    const p=m.locations.find(p=>p.category==='home' && !p.overrides?.person);
    assert.ok(resolveLocation(m,p).extra.livelihood.text);
  }
});

test('explicit trade focuses keep authored landmark trades and guild contracts coherent',async()=>{
  const m=debugMap(makeMap());m.locations[0].generation={trade:'shipwright'};m.locations[0].overrides={name:'Authored Shipyard'};
  const r=resolveLocation(m,m.locations[0]);assert.equal(r.extra.facts.text.split('|')[0],'shipyard');assert.match(r.person,/shipwright/);assert.match(r.extra.stock.text,/hull planks|keel timbers|ship ribs|rudder stocks|mast steps|deck beams|hatch covers|boat knees|caulking seams|launch cradles/i);
  const fixed=place('fixed','blacksmith');fixed.generation={trade:'translator'};
  assert.match(resolveLocation({...m,locations:[fixed]},fixed).person,/smith/);
  m.locations[0].generation.trade='unknown';assert.throws(()=>validateMap(m),/trade focus/);
  const source=JSON.parse(await readFile(new URL('../public/data/maps/dragonsgate.json',import.meta.url)));
  for(const [id,trade] of Object.entries({'dg-0013':'bellfounder','dg-0038':'shipwright','dg-0039':'ropemaker','island-market-hall':'weaver'})) {
    const p=source.locations.find(p=>p.id===id);assert.equal(p.generation.trade,trade);
    assert.ok(resolveLocation(source,p).extra.tradeLinks.text.includes(tradeCatalog[trade].label));
  }
});
test('teahouses and cookshops do not acquire inn rooms and tea menus suit their type',()=>{
  const m=makeMap();m.locations=[place('tea','teahouse'),place('cook','cookshop')];validateMap(m);
  const [tea,cook]=materializeMap(m).locations;
  assert.equal(tea.extra.lodgings.text,'');assert.equal(cook.extra.lodgings.text,'');
  assert.match(tea.extra.meals.text,/tea|infusion/i);assert.doesNotMatch(tea.extra.meals.text,/mutton|venison|pork|fish/i);
});

test('focused generic places use their context-filtered custom stock source',()=>{
  const m=makeMap();m.locations[0].generation={trade:'shipwright'};
  m.generator.catalog={detailSources:{stock_shipwright:Array.from({length:100},(_,i)=>({value:`Custom hull fitting ${i}`,when:{trades:['shipwright']}}))}};
  validateMap(m);const p=resolveLocation(m,m.locations[0]);assert.match(p.extra.stock.text,/Custom hull fitting/);assert.doesNotMatch(p.extra.stock.text,/lamp oil|travel rations/);
});
