import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { auditMap, contentIssues, runContentAudit } from '../scripts/audit-content.mjs';
import { materializeMap, resolveLocation } from '../public/js/generation/locations.js';
import { catalogFor, configFor } from '../public/js/generation/config.js';
import { baseIdentity } from '../public/js/generation/social/identity.js';
import { tradeCatalog } from '../public/js/generation/economy-catalog.js';
import { productWorkflow, scenariosForProduct } from '../public/js/generation/prose/workflows.js';
import { siteProfiles } from '../public/js/generation/prose/place-profiles.js';
import { geographySources, geographyNotes, geographyRumors } from '../public/js/generation/prose/geography.js';
import { menuSources, lodgingSources, guestSources } from '../public/js/generation/prose/hospitality.js';
import { hoursSources, observances, portActivity, household } from '../public/js/generation/prose/civic-details.js';
import { practicalTraditions, workLeads, currentWork } from '../public/js/generation/prose/commerce.js';
import { householdProseSources } from '../public/js/generation/prose/households.js';
import { serviceStorySources, directRequests } from '../public/js/generation/prose/service-stories.js';
import { profileDetailSources, selectGuests } from '../public/js/generation/prose/detail-sources.js';
import { validateMap } from '../public/js/map-contract.js';
import { render } from '../public/js/generation/random.js';
import { streams } from '../public/js/generation/helpers-v2.js';

test('the audit recognizes the legacy issues and the new profile clears all supported types',()=>{
  const old=runContentAudit({polished:false,settlements:['town'],races:['human'],socialModes:[false]});
  assert.ok(old.issues>0);assert.ok(old.counts['residence-advertising']);
  const next=runContentAudit({settlements:['town','port','academy','undercity'],races:['human','elf','orc'],socialModes:[false,true]});
  assert.equal(next.issues,0,JSON.stringify(next.examples));assert.ok(next.types>140);
});
test('every new recipe has 100 distinct complete variations without narration wrappers',()=>{
  const banks={...geographySources,...geographyNotes,...geographyRumors,...menuSources,...lodgingSources,...hoursSources,...householdProseSources,...workLeads,...currentWork,...serviceStorySources,directRequests,observances,portActivity,household,...profileDetailSources()};
  for(const [kind,p] of Object.entries(siteProfiles))for(const [field,values] of Object.entries(p))banks[`${kind}.${field}`]=values;
  for(const [settlement,types] of Object.entries(guestSources))for(const [kind,values] of Object.entries(types))banks[`${settlement}.${kind}`]=values;
  for(const [flow,traditions] of Object.entries(practicalTraditions))for(const [ancestry,values] of Object.entries(traditions))banks[`${flow}.${ancestry}`]=values;
  const context={...Object.fromEntries(['displayName','district','region','label','service','product','customer','fullName','headName','memberNames','domesticTask','item','productName','supplier','buyer','fromPlace','toPlace','fromDistrict','requester','goal'].map(key=>[key,`example-${key}`])),amount:'18'};
  for(const [key,values] of Object.entries(banks)) {
    assert.ok(values.length>=100,key);assert.equal(new Set(values).size,values.length,key);
    const expanded=values.map(value=>render(value,context));
    assert.equal(new Set(expanded).size,values.length,key);
    for(const text of expanded)assert.doesNotMatch(text,/\{\w+\}|\.\.|help to help|mapped geography|household register|original account/,key);
  }
});
test('mixed businesses classify the selected product and choose compatible work and story families',()=>{
  for(const [trade,product,expected] of [
    ['boarding_house','weekly rooms','service'],['teahouse','tea-room bookings','service'],['teahouse','almond cakes','provisions'],['tutor','reading lessons','service'],
    ['bathkeeper','private baths','service'],['bathkeeper','linen towels','goods'],['freight_broker','freight receipts','documents'],['stonemason','inspection plate drain cover','craft'],
    ['bookseller','coastal atlas','goods'],['stationer','black ink','goods'],['map_engraver','map plates','craft'],['surveyor','survey markers','goods']
  ])assert.equal(productWorkflow(tradeCatalog[trade],product,tradeCatalog[trade].category),expected,trade+' '+product);
  const allowed=scenariosForProduct(tradeCatalog.boarding_house,'weekly rooms',{category:'tavern'});
  for(const bad of ['damaged','delivery','replacement','collection','makers_mark'])assert.ok(!allowed.includes(bad));
});
test('visitors have different roles and activities, and cookshops and teahouses have no lodgings',()=>{
  for(const [settlement,kinds] of Object.entries(guestSources))for(const [kind,values] of Object.entries(kinds))for(let seed=0;seed<10;seed++) {
    const picked=selectGuests(values,2,streams([settlement,kind,seed])('guests'));
    assert.notEqual(picked[0].split(' is ')[0],picked[1].split(' is ')[0]);assert.notEqual(picked[0].split(' is ')[1],picked[1].split(' is ')[1]);
  }
  const map=auditMap(),p=materializeMap(map).locations;
  for(const kind of ['cookshop','teahouse']) {
    const place=p.find(p=>p.type===kind);assert.equal(place.extra.lodgings.text,'');
    assert.doesNotMatch(place.extra.guests.text,/bed for|lodging|weekly room/);
  }
});
test('profiles preserve identity, custom fields, context, field selection and compact input',()=>{
  const source=auditMap(),place=source.locations.find(p=>p.type==='grave');
  const old=structuredClone(source);delete old.generator.proseVersion;
  assert.equal(resolveLocation(source,place).name,resolveLocation(old,old.locations.find(p=>p.id===place.id)).name);
  place.overrides={description:'An authored grave.',person:'An authored contact.',services:'An authored service.',landmarkNotes:'An authored note.'};
  place.generation={tables:{rumor:['A custom rumor.']}};
  const before=JSON.stringify(source),resolved=resolveLocation(source,place);
  assert.equal(resolved.description,'An authored grave.');assert.equal(resolved.person,'An authored contact.');assert.equal(resolved.services,'An authored service.');
  assert.equal(resolved.rumor,'A custom rumor.');assert.equal(resolved.extra.landmarkNotes.text,'An authored note.');assert.equal(JSON.stringify(source),before);
  const m=auditMap(),p=m.locations.find(p=>p.type==='tutor'),a=resolveLocation(m,p);
  const changed=structuredClone(m);changed.locations.reverse();const cp=changed.locations.find(q=>q.id===p.id);cp.x=400;cp.generation={fields:['name','person','commissions']};
  const b=resolveLocation(changed,cp);assert.equal(b.name,a.name);assert.equal(b.person,a.person);assert.equal(b.extra.commissions.text,a.extra.commissions.text);assert.equal(b.description,'');
  assert.ok(a.description.includes('North Crossing'));
});
test('empty and dependent homes do not acquire occupations or public services, with either social mode',()=>{
  for(const social of [false,true])for(const age of ['adult','child']) {
    const source=auditMap({social});source.locations=source.locations.filter(p=>p.type==='home');
    delete source.locations[0].context;
    source.locations[0].generation={demographics:{age,population:age==='child'?1:0}};
    const p=resolveLocation(source,source.locations[0]);assert.equal(p.services,'');
    if(age==='adult'){assert.equal(p.person,'');assert.doesNotMatch(p.description,/belongings fill|slates|pantry|meals/);}
    else {assert.match(p.person,/dependent/);assert.doesNotMatch(p.extra.livelihood.text,/works as|serves .* in/);}
  }
});
test('published and newly uploaded maps select the validated prose profile',async()=>{
  for(const name of ['dragonsgate','grayhaven']) {
    const m=JSON.parse(await readFile(new URL(`../public/data/maps/${name}.json`,import.meta.url)));
    assert.equal(m.generator.proseVersion,1);validateMap(m);
  }
  const bad=auditMap();bad.generator.proseVersion=2;assert.throws(()=>validateMap(bad),/prose profile/);
  const legacy=auditMap({polished:false});assert.equal(catalogFor(legacy).types.tavern.roles[0],'innkeeper');
});
test('published home and pier customizations retain their names without building or occupancy errors',async()=>{
  const dragonsgate=JSON.parse(await readFile(new URL('../public/data/maps/dragonsgate.json',import.meta.url)));
  const home=dragonsgate.locations.find(p=>p.category==='home' && !p.overrides?.description && !p.overrides?.person);
  home.generation={...home.generation,demographics:{...home.generation?.demographics,population:0}};
  const empty=resolveLocation(dragonsgate,home);assert.equal(empty.person,'');assert.equal(empty.services,'');assert.match(empty.description,/unoccupied|no permanent|empty|no resident|no household|vacant|no permanent occupants/i);
  const grayhaven=JSON.parse(await readFile(new URL('../public/data/maps/grayhaven.json',import.meta.url)));
  const source=auditMap();source.generator.catalog={types:{pier:grayhaven.generator.catalog.types.pier}};
  const p={id:'custom-pier',type:'pier',category:'harbor',district:'ward',x:100,y:100};source.locations.push(p);
  const result=resolveLocation(source,p);assert.doesNotMatch(result.description,/counter|cellar|lease|kitchen|roof|bed/);
  assert.ok(result.name);assert.ok(result.services);
});
test('both engines support the profile and shared profiles use the same occupation as their resident records',()=>{
  for(const version of [1,2])for(const gender of ['female','male','nonbinary']) {
    const source=auditMap({social:true,gender});source.generator.version=version;
    source.locations=source.locations.filter(p=>['home','tavern','temple','guild','harbor','tutor','grave'].includes(p.type));
    for(const p of source.locations)delete p.context;
    for(const p of materializeMap(source).locations) {
      assert.equal(contentIssues(p).length,0);
      const head=p.community?.residents?.[0];
      if(head && !p.overrides?.person)assert.ok(p.person.includes(head.occupation),p.type+' '+p.person+' '+head.occupation);
      assert.doesNotMatch(p.person,/They is|He are|She are/);
    }
  }
});
test('a literal authored keeper does not gain a second generated contact in standalone leads',()=>{
  for(const social of [false,true])for(let seed=0;seed<12;seed++) {
    const source=auditMap({social,seed:String(seed)});
    source.locations=source.locations.filter(p=>['tutor','road'].includes(p.type));
    const p=source.locations.find(p=>p.type==='tutor');p.overrides={name:'Written Study',person:'Neri, a retired tutor.'};
    const hidden=baseIdentity(source,p,configFor(source,p).config,catalogFor(source,p)).fullName;
    const result=resolveLocation(source,p);
    assert.equal(result.person,'Neri, a retired tutor.');assert.ok(!result.rumor.includes(hidden),result.rumor);
  }
});
