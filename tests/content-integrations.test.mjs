import { test } from 'node:test';
import assert from 'node:assert/strict';
import { integrationSettings, boardRecipe, validateIntegrations } from '../public/js/integrations/config.js';
import { contentSeed, questRequest, sorrowRequests } from '../public/js/integrations/requests.js';
import { ContentClient, safeLink } from '../public/js/integrations/client.js';
import { questHTML, sorrowHTML } from '../public/js/integrations/render.js';
import { ConnectedContent } from '../public/js/integrations/panel.js';
import { integrationForm, readIntegrations } from '../public/js/authoring/integration-form.js';
import { ancestries } from '../public/js/generation/settlement-pools-v1.js';
import { applySettings } from '../public/js/generation/settlement-settings.js';
import { materializeMap, resolveLocation } from '../public/js/generation/locations.js';
import { catalogFor } from '../public/js/generation/config.js';
import { validateMap } from '../public/js/map-contract.js';
import { variationModel } from '../public/js/local-maps/variations.js';
import { serializeMap } from '../public/js/authoring/model.js';
import { matches, searchPlaces } from '../public/js/spatial.js';

const options={quests:{apiVersion:'1',locations:['guild','tavern','watch','temple','harbor','college','roadside','forest','desert','grassland','hills','mountain','swamp','underdark'].map(id=>({id})),tones:['Mixed','Grim']},
  sorrow:{apiVersion:'1',races:Object.keys(ancestries).map(r=>r.replaceAll('_','-')),sexes:['male','female','nonbinary'],ages:['child','adolescent','young adult','adult','middle-aged','old','ancient'],occupations:['commoner','mason','healer']}};
const place=(id,category='landmark',type=category)=>({id,category,type,x:50,y:50,district:'ward'});
function source() {
  return {id:'test-map',name:'Alderwick',subtitle:'Town',description:'A town',region:'The Vale',theme:'Town',width:100,height:100,image:'map.webp',thumbnail:'thumb.webp',schemaVersion:2,
    generator:{version:2,seed:'fixed',defaults:{demographics:{race:'elf',age:'elder',gender:'nonbinary'}}},
    districts:[{id:'ward',name:'Old Ward',generation:{settlement:{type:'forest_hold',environment:['woodland']}}}],
    locations:[place('burial','landmark','graveyard'),place('guild','guild'),place('merchant','shop'),place('river','water','river')]};
}
const rendered=(map,id)=>resolveLocation(map,map.locations.find(p=>p.id===id));
const board=(view='player')=>({apiVersion:'1',view,key:'fixed-key',links:{player:'https://help.dndadventurerslog.com/board/abc?view=player',dm:'https://help.dndadventurerslog.com/board/abc?view=dm'},
  quests:[{id:'q-1',title:'<img src=x onerror=bad()>',body:'Find the lost package.',reward:'5 sp',links:{player:'https://help.dndadventurerslog.com/board/abc?view=player',dm:'https://help.dndadventurerslog.com/board/abc?view=dm'},dm:{truth:'SECRET TRUTH',objective:'Recover the parcel'}}]});
const sorrow=()=>({apiVersion:'1',items:[{npc:{name:'<script>bad()</script>',race:'elf',age:'old',skill:'mason'},story:{scene:'A worn marker.',findings:[{label:'Ring',text:'<b>A copper ring</b>'}]},links:{player:'https://sorrow.dndadventurerslog.com/story/player?seed=fixed',dm:'https://sorrow.dndadventurerslog.com/story/dm?seed=fixed'}}]});
const memory=()=>{let value;return {getItem:()=>value,setItem:(k,v)=>{value=v;}};};

test('eligibility follows semantic types and explicit overrides without parsing names',()=>{
  for(const type of ['graveyard','cemetery','necropolis','tomb','crypt','mausoleum','grave'])assert.equal(integrationSettings(place('x','landmark',type)).sorrow.enabled,true);
  for(const category of ['guild','shop','workshop','tavern','temple','harbor'])assert.equal(integrationSettings(place('x',category)).quests.enabled,true);
  for(const category of ['home','water','terrain','street','landmark'])assert.equal(integrationSettings(place('x',category)).quests.enabled,false);
  assert.equal(integrationSettings({...place('x','guild'),integrations:{quests:{enabled:false}}}).quests.enabled,false);
  assert.equal(integrationSettings({...place('x'),integrations:{sorrow:{npc:{name:'Ada'}}}}).sorrow.count,1);
  assert.equal(integrationSettings({...place('x'),name:'The Cemetery Tavern'}).sorrow.enabled,false);
});
test('burial types are authorable with robust banks and preserve authored text',()=>{
  const m=source();validateMap(m);
  for(const type of ['graveyard','cemetery','necropolis','tomb','crypt','mausoleum','grave']) {
    for(const key of ['nouns','roles','services'])assert.ok(new Set(catalogFor(m).types[type][key]).size>=100);
    assert.equal(resolveLocation(m,{...place('burial','landmark',type),overrides:{name:'The Remembered'}}).name,'The Remembered');
  }
});
test('recipes prioritize building functions and actual geography rather than ancestry',()=>{
  assert.equal(boardRecipe(place('x','guild'),{environment:['woodland']}),'guild');
  assert.equal(boardRecipe(place('x','shop'),{environment:['woodland']}),'forest');
  assert.equal(boardRecipe(place('x','shop'),{environment:[],navigable:true}),'harbor');
  assert.equal(boardRecipe(place('x','landmark','barracks'),{environment:['woodland']}),'watch');
  assert.equal(boardRecipe(place('x','tavern'),{environment:['underground']}),'tavern');
  for(const race of Object.keys(ancestries))assert.equal(boardRecipe(place('x','shop'),{environment:[],race}),'guild');
  const m=source();assert.equal(questRequest(m,rendered(m,'merchant'),options.quests).locationId,'forest');
});
test('requests follow effective ancestry and inherited demographics across all eleven ancestries',()=>{
  for(const race of Object.keys(ancestries)) {
    const m=applySettings(source(),{ancestry:race,seed:'session-seed'}),req=sorrowRequests(m,rendered(m,'burial'),options.sorrow)[0];
    assert.equal(req.npc.race,race.replaceAll('_','-'));assert.equal(req.npc.age,'old');assert.equal(req.npc.sex,'nonbinary');
    assert.equal(req.locationName,'Alderwick');assert.ok(req.seed.length<=64);assert.equal(req.npc.name,undefined);assert.equal(req.npc.occupation,undefined);
  }
  const m=source(),q=questRequest(m,rendered(m,'guild'),options.quests),dm=questRequest(m,rendered(m,'guild'),options.quests,'dm');
  assert.equal(q.view,'player');assert.equal(q.context.districtName,'Old Ward');assert.equal(q.context.placeName,rendered(m,'guild').name);assert.equal(dm.seed,q.seed);
});
test('seeds ignore geometry, ordering and local IDs but react to seeds and revisions',()=>{
  const m=source(),before=serializeMap(m),initial=sorrowRequests(m,rendered(m,'burial'),options.sorrow);
  const copy=structuredClone(m);copy.locations.reverse();copy.locations.find(p=>p.id==='burial').x=15;
  assert.deepEqual(sorrowRequests(copy,rendered(copy,'burial'),options.sorrow),initial);
  const variation=variationModel(m,m,'local-copy');assert.deepEqual(sorrowRequests(variation,rendered(variation,'burial'),options.sorrow),initial);
  assert.deepEqual(questRequest(variation,rendered(variation,'guild'),options.quests),questRequest(m,rendered(m,'guild'),options.quests));
  copy.generator.seed='different';assert.notEqual(sorrowRequests(copy,rendered(copy,'burial'),options.sorrow)[0].seed,initial[0].seed);
  copy.generator.seed=m.generator.seed;copy.locations.find(p=>p.id==='burial').generation={revision:1};
  assert.notEqual(sorrowRequests(copy,rendered(copy,'burial'),options.sorrow)[0].seed,initial[0].seed);
  assert.equal(serializeMap(m),before);assert.equal(new Set(Array.from({length:2000},(_,i)=>contentSeed(i))).size,2000);
});
test('adding graves retains earlier identities and mixed populations use inherited weights',()=>{
  const m=source();m.generator.defaults.demographics={races:{elf:1,dwarf:1}};
  const initial=sorrowRequests(m,rendered(m,'burial'),options.sorrow);m.locations[0].integrations={sorrow:{count:6}};
  const more=sorrowRequests(m,rendered(m,'burial'),options.sorrow);assert.deepEqual(more.slice(0,3),initial);assert.equal(new Set(more.map(r=>r.seed)).size,6);
  const races=new Set();for(let i=0;i<30;i++){m.generator.seed=String(i);sorrowRequests(m,rendered(m,'burial'),options.sorrow).forEach(r=>races.add(r.npc.race));}
  assert.deepEqual([...races].sort(),['dwarf','elf']);assert.deepEqual(materializeMap(m).locations[0].integrations,m.locations[0].integrations);
});
test('explicit NPC constraints and live option contracts reject unsupported values',()=>{
  const m=source();m.locations[0].integrations={sorrow:{count:1,npc:{name:'Alma',race:'half_elf',age:320,sex:'female',occupation:'mason'}}};
  assert.deepEqual(sorrowRequests(m,rendered(m,'burial'),options.sorrow)[0].npc,{name:'Alma',race:'half-elf',age:320,sex:'female',occupation:'mason'});
  m.locations[0].integrations.sorrow.npc.race='custom-folk';assert.throws(()=>sorrowRequests(m,rendered(m,'burial'),options.sorrow),/does not support race/);
  m.locations[1].integrations={quests:{locationId:'unavailable'}};assert.throws(()=>questRequest(m,rendered(m,'guild'),options.quests),/does not support/);
  m.locations[1].integrations={quests:{tone:'Nope'}};assert.throws(()=>questRequest(m,rendered(m,'guild'),options.quests),/tone/);
});
test('invalid settings fail before local save and editor settings roundtrip compactly',()=>{
  for(const bad of [null,[],{unknown:{}},{sorrow:{count:0}},{sorrow:{count:7}},{quests:{enabled:'yes'}},{quests:{level:21}},{quests:{count:5}},{sorrow:{npc:{age:-1}}},{sorrow:{npc:{name:'Ada'},count:2}}])assert.throws(()=>validateIntegrations(bad),/Connected content/);
  const p=place('site'),data=new FormData();
  for(const [k,v] of Object.entries({quests:'on',recipe:'temple',level:'5','quest-count':'8',tone:'Grim',sorrow:'on','npc-name':'Alma','npc-age':'320','npc-race':'elf'}))data.set('content-'+k,v);
  readIntegrations(data,p);validateIntegrations(p.integrations);assert.equal(p.integrations.quests.level,5);assert.equal(p.integrations.sorrow.count,1);assert.equal(p.integrations.sorrow.npc.age,320);
  assert.match(integrationForm(p),/value="temple"/);const m=source();m.locations[0].integrations=p.integrations;
  assert.deepEqual(JSON.parse(serializeMap(m)).locations[0].integrations,p.integrations);
  m.locations[0].integrations={sorrow:{count:99}};assert.throws(()=>validateMap(m),/Connected content/);
});
test('requests omit credentials and snapshots plus options reopen offline',async()=>{
  const storage=memory(),calls=[];
  const client=new ContentClient({storage,fetcher:async(url,init)=>{calls.push({url,init});return Response.json(url.endsWith('/options')?options.quests:board());}});
  await client.getOptions('quests');const input={seed:'fixed',view:'player'};await client.generate('quests',input);await client.generate('quests',input);
  assert.equal(calls.length,2);assert.equal(calls[1].init.credentials,'omit');assert.equal(calls[1].init.method,'POST');
  const offline=new ContentClient({storage,fetcher:async()=>{throw new Error('offline');}});
  assert.deepEqual(await offline.getOptions('quests'),options.quests);assert.deepEqual(await offline.generate('quests',input),board());
});
test('errors, malformed responses, cancellation and full storage leave retries usable',async()=>{
  let attempt=0;const client=new ContentClient({storage:{getItem(){throw new Error('disabled');},setItem(){throw new Error('quota');}},fetcher:async()=>{
    attempt++;return attempt===1?Response.json({error:{message:'Temporary outage'}},{status:503}):attempt===2?Response.json({apiVersion:'1',quests:[]}):Response.json(board());
  }});
  await assert.rejects(client.generate('quests',{}),/Temporary outage/);await assert.rejects(client.generate('quests',{}),/incomplete response/);
  assert.equal((await client.generate('quests',{})).key,'fixed-key');assert.equal(attempt,3);
  const controller=new AbortController();controller.abort();await assert.rejects(client.generate('quests',{seed:'other'},controller.signal),/Cancelled/);
});
test('player rendering escapes remote text and excludes DM fields and unsafe URLs',()=>{
  const html=questHTML(board('dm'),'player');assert.ok(!html.includes('SECRET TRUTH'));assert.ok(!html.includes('?view=dm'));assert.ok(!html.includes('<img'));assert.match(html,/&lt;img/);
  assert.match(questHTML(board('dm'),'dm'),/SECRET TRUTH/);
  const graves=sorrowHTML(sorrow().items,'player');assert.ok(!graves.includes('<script>'));assert.ok(!graves.includes('<b>'));assert.ok(!graves.includes('DM reference'));
  for(const url of ['javascript:alert(1)','https://evil.example/story','https://help.dndadventurerslog.com.evil.example/','https://user@help.dndadventurerslog.com/'])assert.equal(safeLink('quests',url),null);
  assert.ok(safeLink('quests',board().links.player));
});
test('closing a callout cancels pending requests and prevents stale rendering',async()=>{
  let resolve,aborted=false,renders=0;const panel=Object.create(ConnectedContent.prototype),m=source();
  panel.viewer={generationSource:m};panel.place=rendered(m,'guild');panel.states={quests:{view:'player'}};panel.render=()=>{renders++;};
  panel.client={getOptions:async()=>options.quests,generate:async(kind,input,signal)=>{
    signal.addEventListener('abort',()=>{aborted=true;});return new Promise(done=>{resolve=done;});
  }};
  const pending=panel.load('quests');await new Promise(done=>setImmediate(done));panel.close();resolve(board());await pending;
  assert.equal(aborted,true);assert.equal(renders,1);assert.deepEqual(panel.states,{});
});
test('directory searches find quest boards without loading remote content',async()=>{
  const guild={...place('one','guild'),name:'The Brass Compass',featured:false};
  for(const query of ['quest board','quest boards','quest-board','notice board','job board','help board','side quests'])assert.ok(matches(guild,{query}),query);
  const merchant={...place('two','shop'),name:'The Copper Scale'};
  const disabled={...place('three','guild'),integrations:{quests:{enabled:false}}};
  const custom={...place('four'),integrations:{quests:{enabled:true}}};
  assert.deepEqual(await searchPlaces([guild,merchant,disabled,custom],{query:'quest boards'}),[guild,merchant,custom]);
  assert.equal(matches(guild,{query:'quest board',category:'temple'}),false);
  assert.equal(matches(guild,{query:'quest board',district:'Elsewhere'}),false);
  assert.ok(matches({...place('five','landmark','adventurers_guild')},{query:'adventurers guild'}));
});
test('directory searches find burial types, synonyms and explicitly enabled story locations',async()=>{
  const m=source(),burial=rendered(m,'burial');
  for(const query of ['burial site','burial sites','burial ground','grave site','graveyard','cemetery','cemeteries','NPC Sorrow'])assert.ok(matches(burial,{query}),query);
  const crypt={...place('crypt-place','landmark','crypt'),name:'The Quiet Door',integrations:{sorrow:{enabled:false}}};
  assert.ok(matches(crypt,{query:'crypt'}));assert.ok(matches(crypt,{query:'burial sites'}));
  const custom={...place('memorial'),integrations:{sorrow:{enabled:true}}};
  assert.ok(matches(custom,{query:'burial site'}));
  const house=place('home','home');assert.equal(matches(house,{query:'burial sites'}),false);
  assert.deepEqual(await searchPlaces([burial,crypt,custom,house],{query:'burial sites',category:'landmark',district:'ward'}),[crypt,custom]);
});
