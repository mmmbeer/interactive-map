import test from 'node:test';
import assert from 'node:assert/strict';
import { regionPlan, tileCoverage, sourceClass, canonicalBounds } from '../public/js/world-maps/region-scale.js';
import { checkRegion, checkArea } from '../public/js/world-maps/geo.js';
import { selectedTiles } from '../public/js/world-maps/prepared.js';
import { convertArea } from '../public/js/world-maps/model.js';
import { sourceGroup, normalizeSourceSelection } from '../public/js/world-maps/source-selection.js';
import { validateMap } from '../public/js/map-contract.js';
import { contains } from '../public/js/geometry.js';
import { blockers, routeClear } from '../public/js/world-maps/procedural-space.js';
import { planSummary, resultSummary } from '../public/js/world-maps/wizard-summary.js';
const boundsForMeters=m=>({west:0,south:0,east:m/111195,north:m/111195});
const options={bounds:boundsForMeters(1500),width:1400,height:1400,id:'local-region-test',name:'Region test',seed:'region-test',regional:true,settlement:{type:'town'}};
const way=(id,tags,points)=>({type:'way',id,tags,geometry:points.map(([lon,lat])=>({lon,lat}))});
const rect=(id,tags,x,y,w,h)=>way(id,tags,[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]]);
function source() {
  return {elements:[rect(1,{building:'yes'},.003,.003,.0002,.0002),rect(2,{natural:'water',water:'lake'},.010,0,.001,.013),
    way(3,{highway:'primary'},[[0,.004],[.009,.004]]),way(4,{highway:'secondary'},[[0,.005],[.009,.005]]),way(5,{highway:'residential'},[[0,.006],[.009,.006]]),way(6,{highway:'service'},[[0,.007],[.009,.007]]),rect(7,{natural:'wood'},.001,.010,.002,.002)]};
}
test('coverage unlocks successively finer classes without depending on export resolution',()=>{
  const cases=[[400,'block','paths'],[1500,'city','buildings'],[5000,'town','roads'],[25000,'region','majorRoads'],[150000,'landscape','water'],[2500000,'shape','coast']];
  for(const [meters,level,key] of cases) {
    const bounds=boundsForMeters(meters),p=regionPlan(bounds);assert.equal(p.level,level);assert.ok(p.groups.includes(key));
    assert.ok(tileCoverage(bounds,p.zoom).count<=64);assert.equal(selectedTiles(bounds,p.zoom,{regional:true}).length,tileCoverage(bounds,p.zoom).count);
  }
  assert.ok(!regionPlan(boundsForMeters(5000)).groups.includes('cityStreets'));assert.ok(!regionPlan(boundsForMeters(1500)).groups.includes('paths'));
  const polar=regionPlan({west:0,south:84,east:.15,north:84.016});assert.ok(polar.zoom<15);assert.ok(!polar.groups.includes('buildings'));
  assert.deepEqual(canonicalBounds({west:1.000000000001,south:2.000000000001,east:3,north:4}),{west:1,south:2,east:3,north:4});
  assert.equal(sourceClass({highway:'primary'}),'majorRoads');assert.equal(sourceClass({highway:'secondary'}),'roads');assert.equal(sourceClass({highway:'residential'}),'cityStreets');assert.equal(sourceClass({highway:'service'}),'paths');
});
test('continent selections remain bounded and detailed live queries retain their old safety limits',()=>{
  const world={west:-179,south:-80,east:179,north:80};assert.ok(checkRegion(world));assert.throws(()=>checkArea(world),/Zoom in/);
  assert.ok(selectedTiles(world,regionPlan(world).zoom,{regional:true}).length<=64);
  assert.throws(()=>selectedTiles(world,15,{regional:true}),/too many/);
  assert.equal(regionPlan(world).liveEligible,false);assert.throws(()=>checkRegion({...world,east:181}));
});
test('survey filters source detail at the selected size and accepts an empty inland cutout for generation',()=>{
  const a=convertArea(source(),{...options,survey:true}).map;
  assert.ok(a.locations.some(p=>sourceGroup(p)==='buildings'));assert.ok(!a.locations.some(p=>sourceGroup(p)==='paths'));
  const broad=convertArea(source(),{...options,bounds:boundsForMeters(3000000),survey:true}).map;
  assert.equal(broad.locations.length,0);assert.equal(broad.worldImport.regionPlan.level,'shape');assert.equal(broad.worldImport.procedural,undefined);
  const resized=convertArea(source(),{...options,width:4096,height:2048,survey:true}).map;assert.deepEqual(resized.worldImport.regionPlan,a.worldImport.regionPlan);
});
test('empty broad source generates real geometry for a complete settlement and scales travel distances',()=>{
  const args={...options,bounds:boundsForMeters(1800000),settlement:{type:'city',features:['tavern','market','temple']}};
  const {map}=convertArea({elements:[]},args);validateMap(map);
  const decisions=map.worldImport.procedural.decisions;
  for(const key of ['water','woodland','majorRoads','roads','cityStreets','paths','buildings'])assert.ok(decisions[key].generated>0,`No generated ${key}`);
  assert.ok(map.locations.some(p=>p.type==='tavern'));assert.ok(map.locations.some(p=>p.type==='temple'));
  assert.ok(map.locations.filter(p=>p.worldStyle.kind==='building').every(p=>p.context.street));
  assert.equal(map.worldImport.distanceScale.fantasyWidthMeters,3500);assert.equal(map.measurement.metersPerPixel,3500/map.width);
  assert.deepEqual(convertArea({elements:[]},args).map,map);
  const kept=convertArea({elements:[]},{...args,reinterpret:false}).map;assert.ok(kept.measurement.metersPerPixel>1000);
});
test('retained layers suppress their generated counterparts while unavailable layers are filled',()=>{
  const {map}=convertArea(source(),options);validateMap(map);
  for(const key of ['water','woodland','majorRoads','roads','cityStreets','buildings']) {
    const d=map.worldImport.procedural.decisions[key];assert.equal(d.mode,'mapped',key);assert.equal(d.generated,0,key);
  }
  assert.ok(map.worldImport.procedural.decisions.paths.generated>0);
  const surveyed=convertArea(source(),{...options,survey:true}).map;
  for(const p of surveyed.locations){const actual=map.locations.find(q=>q.id===p.id);assert.deepEqual(actual.shape,p.shape);}
});
test('deselected or individually exhausted layers generate replacements without restoring excluded source ids',()=>{
  const surveyed=convertArea(source(),{...options,survey:true}).map,excluded=surveyed.locations.filter(p=>sourceGroup(p)==='buildings').map(p=>p.id);
  const input={version:2,groups:regionPlan(options.bounds).groups.filter(k=>k!=='cityStreets'&&k!=='water'),excluded};
  const {map}=convertArea(source(),{...options,sourceSelection:input});validateMap(map);
  assert.ok(map.locations.every(p=>!excluded.includes(p.id)));assert.ok(map.worldImport.procedural.decisions.buildings.generated>0);
  assert.equal(map.worldImport.procedural.decisions.cityStreets.reason,'deselected');assert.equal(map.worldImport.procedural.decisions.water.reason,'deselected');
  assert.ok(!map.locations.some(p=>p.id==='osm-way-2-0'));assert.ok(!map.locations.some(p=>p.id==='osm-way-5-0'));
  assert.ok(map.worldImport.procedural.decisions.cityStreets.generated>0);
});
test('coast outlines remain exact and all generated buildings and routes stay off ocean water',()=>{
  const bounds=boundsForMeters(1600000),w=bounds.east,h=bounds.north;
  const data={elements:[{type:'relation',id:1,tags:{type:'multipolygon',natural:'water',water:'sea'},members:[
    {type:'way',ref:1,role:'outer',geometry:[[0,0],[w,0],[w,h],[0,h],[0,0]].map(([lon,lat])=>({lon,lat}))},
    {type:'way',ref:2,role:'inner',geometry:[[w*.17,h*.2],[w*.8,h*.16],[w*.85,h*.7],[w*.5,h*.87],[w*.16,h*.7],[w*.17,h*.2]].map(([lon,lat])=>({lon,lat}))}
  ]}]};
  const args={...options,bounds,settlement:{type:'city'}},survey=convertArea(data,{...args,survey:true}).map,water=survey.locations[0];
  const {map}=convertArea(data,{...args,sourceSelection:{version:2,groups:[],excluded:[water.id]}});validateMap(map);
  assert.deepEqual(map.locations.find(p=>p.id===water.id).shape,water.shape);
  const waters=map.locations.filter(p=>p.category==='water'),space=blockers({...map,locations:waters});
  assert.ok(map.locations.filter(p=>p.worldStyle.kind==='building').length>100);
  for(const p of map.locations.filter(p=>p.worldStyle.kind==='building'))for(const [x,y] of p.shape.points)assert.ok(!waters.some(w=>contains(w,x,y)),p.id);
  for(const p of map.locations.filter(p=>p.category==='street'&&p.worldStyle.origin==='generated'))assert.ok(routeClear(p.shape.points,p.shape.width,space),p.id);
});
test('ocean-only selections report no buildable land instead of placing floating buildings',()=>{
  const bounds=boundsForMeters(1600000),data={elements:[rect(1,{natural:'water',water:'sea'},0,0,bounds.east,bounds.north)]};
  const {map}=convertArea(data,{...options,bounds});validateMap(map);
  assert.equal(map.locations.filter(p=>p.worldStyle.kind==='building').length,0);assert.ok(map.worldImport.planning.warnings.some(s=>s.includes('dry')));
});
test('layout provenance and seed survive serialization and summaries distinguish mapped and generated results',()=>{
  const {map}=convertArea({elements:[]},{...options,bounds:boundsForMeters(3000000)}),roundTrip=JSON.parse(JSON.stringify(map));validateMap(roundTrip);
  assert.deepEqual(roundTrip.worldImport.procedural,map.worldImport.procedural);
  const survey=convertArea(source(),{...options,survey:true}).map;
  assert.match(planSummary(survey,normalizeSourceSelection({version:2}),{type:'city'}),/Keep mapped/);
  assert.match(resultSummary(map),/generated/);
  const changed=convertArea({elements:[]},{...options,bounds:boundsForMeters(3000000),seed:'different'}).map;
  assert.notDeepEqual(changed.locations,map.locations);
});

test('replacing a stitched mapped water layer removes obsolete fragment aliases',()=>{
  const data=source();data.elements.push(rect(9,{natural:'water',water:'lake'},.011,0,.001,.013));
  const survey=convertArea(data,{...options,survey:true}).map;assert.ok(Object.keys(survey.locationAliases||{}).length);
  const {map}=convertArea(data,{...options,sourceSelection:{version:2,groups:regionPlan(options.bounds).groups.filter(k=>k!=='water')}});
  validateMap(map);assert.deepEqual(map.locationAliases,{});
});
