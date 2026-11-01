import test from 'node:test';
import assert from 'node:assert/strict';
import { convertArea } from '../public/js/world-maps/model.js';
import { enrichSettlement } from '../public/js/world-maps/settlement-enrichment.js';
import { normalizeProfile, recommendations } from '../public/js/world-maps/settlement-profile.js';
import { preparedTags } from '../public/js/world-maps/prepared-geometry.js';
import { catalogFor, configFor } from '../public/js/generation/config.js';
import { applySettings, readSettings } from '../public/js/generation/settlement-settings.js';
import { materializeMap } from '../public/js/generation/locations.js';
import { economicContext } from '../public/js/generation/economy-context.js';
import { validateMap } from '../public/js/map-contract.js';
import { contains } from '../public/js/geometry.js';
const bounds={west:0,south:0,east:.01,north:.01},options={bounds,width:1000,height:1000,id:'local-settlement-test',name:'Settlement test',seed:'settlement-test'};
const geom=points=>points.map(([lon,lat])=>({lon,lat}));
const way=(id,tags,points)=>({type:'way',id,tags,geometry:geom(points)});
const rectangle=(id,tags,x,y,w,h)=>way(id,tags,[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]]);
function data() {
  const elements=[];
  for(let y=0;y<5;y++)for(let x=0;x<8;x++)elements.push(rectangle(100+y*8+x,{building:'yes'},.001+x*.0006,.001+y*.00065,.00016,.00018));
  elements.push(way(1,{highway:'residential'},[[.0001,.0045],[.0099,.0045]]),way(2,{highway:'residential'},[[.0049,.0001],[.0049,.0099]]),rectangle(3,{natural:'water',water:'river'},.0075,0,.0008,.01));
  return {elements};
}
test('settlement inputs affect inherited demographics, names, household counts and economic context',()=>{
  const settlement={type:'farming_village',ancestry:'elf',secondary:'dwarf',secondaryPercent:30,wealth:'comfortable',ages:'older',householdSize:5,resources:['grain','timber'],industries:['agriculture'],environment:['hills']};
  const {map}=convertArea(data(),{...options,settlement});validateMap(map);
  assert.deepEqual(map.generator.defaults.demographics.races,{elf:70,dwarf:30});
  const snapshot=applySettings(map,readSettings(map,'https://atlas.test/',{getItem:()=>null})),material=materializeMap(snapshot);
  assert.ok(material.locations.filter(p=>p.category==='home').every(p=>['elf','dwarf'].includes(p.demographics.race)&&p.demographics.wealth==='comfortable'&&p.demographics.population===5));
  assert.ok(new Set(material.locations.filter(p=>p.category==='home').map(p=>p.demographics.race)).size===2);
  const p=map.locations.find(p=>p.category==='home'),config=configFor(map,p).config,context=economicContext(map,p,config);
  assert.equal(context.settlementType,'farming_village');assert.ok(context.resources.includes('grain'));assert.ok(context.environment.includes('hills'));assert.ok(context.industries.includes('agriculture'));
  assert.equal(map.worldImport.settlement.type,'farming_village');assert.equal(map.settlementSettings.ancestry,'original');
});
test('requested sites reuse actual footprints, adapt building uses and report impossible features',()=>{
  const original=convertArea(data(),options).map,features=['tavern','market','temple','guild','smith','harbor'];
  const {map}=convertArea(data(),{...options,settlement:{type:'city',features}});validateMap(map);
  for(const type of ['tavern','market','temple','adventurers_guild','blacksmith'])assert.ok(map.locations.some(p=>p.type===type),`Missing ${type}`);
  assert.ok(map.worldImport.planning.warnings.some(s=>s.includes('harbor')));
  assert.ok(map.locations.some(p=>p.category==='shop'));assert.ok(map.locations.some(p=>p.category==='workshop'));
  for(const p of map.locations.filter(p=>p.worldStyle?.kind==='building')) {
    const source=original.locations.find(q=>q.id===p.id);assert.deepEqual(p.shape,source.shape);assert.equal(p.x,source.x);assert.equal(p.y,source.y);
  }
  const empty=convertArea({elements:[rectangle(1,{natural:'water',water:'lake'},0,0,.01,.01)]},{...options,settlement:{features,landFeatures:['farmland']}}).map;
  validateMap(empty);assert.equal(empty.locations.length,1);assert.ok(empty.worldImport.planning.warnings.length>=features.length);
});
test('districts have usable boundaries, contain source buildings, preserve islands and regenerate deterministically',()=>{
  const setup={...options,settlement:{districtCount:4}},a=convertArea(data(),setup).map,b=convertArea(data(),setup).map;validateMap(a);
  assert.equal(a.districts.length,4);assert.deepEqual(a,b);
  assert.ok(a.districts.every(d=>d.boundaries.length&&d.label));assert.equal(new Set(a.districts.map(d=>d.name)).size,4);
  for(const p of a.locations.filter(p=>p.worldStyle?.kind==='building'))assert.ok(a.districts.find(d=>d.id===p.district).boundaries.some(shape=>contains({shape},p.x,p.y)),`Building outside assigned district: ${p.id}`);
  const single=convertArea(data(),{...options,settlement:{districtMode:'single'}}).map;assert.equal(single.districts.length,1);
});
test('mapped district polygons are used when present with an explicit fallback when absent',()=>{
  const source=data();source.elements.push(rectangle(900,{place:'neighbourhood',name:'West Ward'},0,0,.0049,.01),rectangle(901,{place:'neighbourhood',name:'East Ward'},.0049,0,.0051,.01));
  const {map}=convertArea(source,{...options,settlement:{districtMode:'mapped'}});validateMap(map);
  assert.deepEqual(map.districts.map(d=>d.name),['West Ward','East Ward']);
  assert.ok(map.locations.filter(p=>p.worldStyle?.kind==='building'&&p.x<490).every(p=>p.district==='district-1'));
  assert.ok(convertArea(data(),{...options,settlement:{districtMode:'mapped'}}).map.worldImport.planning.warnings.some(s=>s.includes('unavailable')));
});
test('mapped farmland, pastures, orchards and burial sites retain their semantic type and source geometry',()=>{
  const source=data();
  for(const [i,use] of ['farmland','pasture','orchard','cemetery'].entries())source.elements.push(rectangle(800+i,{landuse:use},.0001+i*.0017,.006,.0015,.002));
  const {map}=convertArea(source,options);validateMap(map);
  for(const type of ['farmland','pasture','orchard','cemetery'])assert.ok(map.locations.some(p=>p.type===type),`Missing ${type}`);
  assert.equal(map.locations.find(p=>p.type==='cemetery').category,'landmark');
  assert.ok(catalogFor(map).types.farmland);assert.equal(preparedTags({layer:'landuse',type:3,properties:{kind:'farmland',kind_detail:'orchard'}}).landuse,'orchard');
});
test('supplemental rural plots avoid real water, source land uses and building footprints',()=>{
  const source=convertArea(data(),options).map,planned=structuredClone(source);
  enrichSettlement(planned,{type:'farming_village',landFeatures:['farmland','pasture','orchard','graveyard']});validateMap(planned);
  const plots=planned.locations.filter(p=>p.id.startsWith('fantasy-'));assert.ok(plots.length>=2);
  const blocked=source.locations.filter(p=>p.category==='water'||p.worldStyle?.kind==='building');
  for(const p of plots) {
    assert.ok(contains(p,p.x,p.y));
    for(const [x,y] of p.shape.points)assert.ok(!blocked.some(q=>contains(q,x,y)),`Plot touches ${p.id} obstruction`);
    for(const q of blocked)assert.ok(!contains(p,q.x,q.y),`Plot contains source ${q.id}`);
  }
});
test('all supported ancestries validate, invalid demographic and feature inputs fail clearly',()=>{
  for(const ancestry of ['human','orc','elf','dwarf','halfling','dragonborn','gnome','goblin','tiefling','half_elf','half_orc'])validateMap(convertArea(data(),{...options,settlement:{ancestry,features:['market','guild']}}).map);
  for(const input of [{type:'invalid'},{secondary:'human'},{householdSize:0},{secondaryPercent:99},{features:['castle']},{resources:['uranium']},{districtCount:13}])assert.throws(()=>normalizeProfile(input));
  assert.ok(recommendations('farming_village').landFeatures.includes('farmland'));
});
