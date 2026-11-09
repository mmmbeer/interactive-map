import test from 'node:test';
import assert from 'node:assert/strict';
import { convertArea } from '../public/js/world-maps/model.js';
import { sourceGroups, sourceGroup, normalizeSourceSelection, sourceCounts } from '../public/js/world-maps/source-selection.js';
import { sourceAt } from '../public/js/world-maps/source-review.js';
import { planSummary, resultSummary } from '../public/js/world-maps/wizard-summary.js';
import { normalizeProfile } from '../public/js/world-maps/settlement-profile.js';
import { validateMap } from '../public/js/map-contract.js';
const bounds={west:0,south:0,east:.01,north:.01},options={bounds,width:1000,height:1000,id:'local-wizard-test',name:'Wizard test',seed:'wizard'};
const line=(id,tags,points)=>({id,type:'way',tags,geometry:points.map(([lon,lat])=>({lon,lat}))});
const rect=(id,tags,x,y,w=.0005,h=.0005)=>line(id,tags,[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]]);
const data={elements:[rect(1,{building:'yes',amenity:'place_of_worship'},.002,.002),rect(2,{building:'yes',shop:'books'},.003,.002),rect(3,{building:'yes'},.004,.002),line(4,{highway:'residential'},[[0,.003],[.009,.003]]),line(5,{highway:'path'},[[0,.006],[.009,.006]]),rect(6,{natural:'water'},.008,0,.001,.01),rect(7,{natural:'wood'},.001,.007,.002,.002),rect(8,{landuse:'orchard'},.004,.007,.002,.002),rect(9,{landuse:'cemetery'},.006,.004),rect(10,{leisure:'park'},.001,.004)]};
const all=Object.keys(sourceGroups);
test('survey returns source geometry and uses without assigning fantasy sites or planning districts',()=>{
  const a=convertArea(data,{...options,survey:true}),b=convertArea(data,{...options,survey:true});assert.deepEqual(a,b);validateMap(a.map);
  assert.equal(a.map.worldImport.planning,undefined);assert.ok(a.map.locations.some(p=>p.type==='temple'));
  assert.ok(!a.map.locations.some(p=>p.worldStyle.established));
  const counts=sourceCounts(a.map,normalizeSourceSelection());
  for(const [key,total] of Object.entries({buildings:3,roads:1,paths:1,water:1,woodland:1,farmland:1,burial:1,openland:1}))assert.deepEqual(counts[key],{total,kept:total});
});
test('source groups and individual omissions affect both generated geometry and saved import choices',()=>{
  const survey=convertArea(data,{...options,survey:true}),omitted=survey.map.locations.find(p=>p.id.startsWith('osm-way-3-')).id;
  const sourceSelection={groups:all.filter(k=>!['farmland','paths'].includes(k)),excluded:[omitted],buildingUses:'fantasy'};
  const {map}=convertArea(data,{...options,sourceSelection,settlement:{features:['tavern'],assignBusinesses:false}});validateMap(map);
  assert.ok(!map.locations.some(p=>p.id===omitted||p.type==='trail'||p.worldStyle.landuse==='orchard'));
  assert.ok(map.locations.some(p=>p.type==='tavern'));assert.ok(!map.locations.some(p=>['temple','shop','workshop'].includes(p.category)));
  assert.equal(map.worldImport.sourceSelection.buildingUses,'fantasy');assert.deepEqual(map.worldImport.sourceSelection.excluded,[omitted]);
  assert.deepEqual(convertArea(data,{...options,sourceSelection,settlement:{features:['tavern'],assignBusinesses:false}}).map,map);
});
test('mapped hints are optional and generation cannot restore excluded building footprints',()=>{
  const kept=convertArea(data,{...options,sourceSelection:{groups:all,buildingUses:'mapped'},settlement:{assignBusinesses:false}}).map;
  assert.ok(kept.locations.some(p=>p.type==='temple'));assert.ok(kept.locations.some(p=>p.type==='shop'));
  const empty=convertArea(data,{...options,sourceSelection:{groups:all.filter(k=>k!=='buildings')},settlement:{features:['temple','market']}}).map;
  assert.ok(!empty.locations.some(p=>p.worldStyle.kind==='building'));assert.equal(empty.worldImport.planning.established.length,0);
  assert.ok(empty.worldImport.planning.warnings.some(t=>t.includes('footprint')));
});
test('water remains an obstruction even when an exclusion or missing group attempts to omit it',()=>{
  const survey=convertArea(data,{...options,survey:true}).map,water=survey.locations.find(p=>p.category==='water');
  const {map}=convertArea(data,{...options,sourceSelection:{groups:['buildings'],excluded:[water.id]},settlement:{landFeatures:['farmland']}});
  assert.ok(map.locations.some(p=>p.id===water.id));assert.ok(map.worldImport.sourceSelection.groups.includes('water'));
  assert.equal(sourceCounts(survey,normalizeSourceSelection({groups:[],excluded:[water.id]})).water.kept,1);
});
test('individual selection respects polygon holes, restoration and water above overlapping terrain',()=>{
  const map=convertArea(data,{...options,survey:true}).map,p=map.locations.find(p=>p.worldStyle.kind==='building'),selection=normalizeSourceSelection({excluded:[p.id]});
  assert.equal(sourceAt(map,p.x,p.y,selection).id,p.id,'Omitted features remain restorable');
  assert.equal(sourceAt(map,p.x,p.y,normalizeSourceSelection({groups:['water']})),null);
  assert.equal(sourceAt({locations:[{id:'courtyard',category:'home',worldStyle:{kind:'building'},shape:{kind:'polygon',points:[[0,0],[10,0],[10,10],[0,10]],holes:[[[2,2],[8,2],[8,8],[2,8]]]},x:1,y:1}]},5,5,selection),null);
  assert.equal(sourceAt({locations:[{id:'terrain',category:'terrain',type:'field',worldStyle:{landuse:'grass'},shape:{kind:'polygon',points:[[0,0],[10,0],[10,10],[0,10]]},x:5,y:5},{id:'water',category:'water',type:'lake',shape:{kind:'polygon',points:[[2,2],[8,2],[8,8],[2,8]]},x:5,y:5}]},5,5,selection),null);
});
test('invalid source choices fail clearly and defaults preserve existing conversion callers',()=>{
  assert.throws(()=>normalizeSourceSelection({groups:['castle']}));assert.throws(()=>normalizeSourceSelection({excluded:[123]}));
  assert.throws(()=>normalizeProfile({assignBusinesses:'no'}));
  assert.ok(convertArea(data,options).map.locations.some(p=>p.type==='temple'));
  assert.throws(()=>convertArea({elements:[rect(1,{building:'yes'},.001,.001)]},{...options,sourceSelection:{groups:[]}}),/Keep at least one/);
});
test('planning advice reports source limitations and review escapes placement messages',()=>{
  const survey=convertArea(data,{...options,survey:true}).map;
  const summary=planSummary({...survey,locations:survey.locations.filter(p=>p.category!=='water')},normalizeSourceSelection({groups:[]}),normalizeProfile({type:'port',features:['harbor']}));
  assert.match(summary,/No building footprints/);assert.match(summary,/needs navigable water/);assert.match(summary,/No roads/);
  const map=convertArea(data,options).map;map.worldImport.planning.warnings.push('<img src=x>');
  assert.ok(resultSummary(map).includes('&lt;img'));assert.ok(!resultSummary(map).includes('<img'));
});

test('mapped trees are counted with woodland and omitted when that group is turned off',()=>{
  const source={elements:[...data.elements,{type:'node',id:90,tags:{natural:'tree'},lon:.005,lat:.005}]};
  const survey=convertArea(source,{...options,survey:true});assert.equal(survey.trees.length,1);
  assert.equal(sourceCounts(survey.map,normalizeSourceSelection(),survey.trees).woodland.total,2);
  const selection=normalizeSourceSelection({groups:all.filter(k=>k!=='woodland')});
  assert.equal(sourceCounts(survey.map,selection,survey.trees).woodland.kept,0);
  assert.deepEqual(convertArea(source,{...options,sourceSelection:selection}).trees,[]);
});
