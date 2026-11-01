import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reconcileWater, upgradeWorldWater, resolveLocationId } from '../public/js/world-maps/water.js';
import { convertArea } from '../public/js/world-maps/model.js';
import { PreparedGeometry } from '../public/js/world-maps/prepared-geometry.js';
import { upgradeLocalWater, localIndexes } from '../public/js/local-maps/store.js';
import { validateMap } from '../public/js/map-contract.js';
import { contains } from '../public/js/geometry.js';
import { ringArea, unproject } from '../public/js/world-maps/geo.js';
import { materializeMap } from '../public/js/generation/locations.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/split-river.json',import.meta.url)));
const ring=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const polygon=(id,points,type='river',holes=[])=>({id:`osm-water-${id}`,category:'water',type,district:'imported-area',x:points[0][0]+1,y:points[0][1]+1,shape:{kind:'polygon',points,...(holes.length?{holes}:{})},worldStyle:{kind:'water'}});
const line=(id,points,type='river')=>({...polygon(id,points,type),shape:{kind:'polyline',points,width:2},worldStyle:{kind:'river'}});
const map=locations=>({...fixture,width:100,height:100,locations});
const water=map=>map.locations.filter(p=>p.category==='water');

test('reported four-tile river has one identity, complete geometry and its existing name',()=>{
  const original=structuredClone(fixture),fixed=reconcileWater(fixture);validateMap(fixed);
  assert.equal(fixed.locations.length,2);
  const river=fixed.locations.find(p=>p.type==='river'),lake=fixed.locations.find(p=>p.type==='lake');
  assert.equal(river.id,'osm-relation-prepared-water-1579185702-7a090eaf61e5e29a-0');
  const before=materializeMap(fixture).locations.find(p=>p.id===river.id),after=materializeMap(fixed).locations.find(p=>p.id===river.id);
  assert.equal(after.name,before.name);assert.equal(after.name,'Rafael’s Spring River');
  for(const old of fixture.locations) {
    const target=old.type==='river'?river:lake;
    assert.equal(resolveLocationId(fixed,old.id),target.id);
    for(const [x,y] of old.shape.points)assert.ok(contains(target,x,y),`Missing ${old.id} vertex`);
  }
  const oldArea=fixture.locations.filter(p=>p.type==='river'&&p.shape.kind==='polygon').reduce((n,p)=>n+Math.abs(ringArea(p.shape.points)),0);
  assert.ok(Math.abs(Math.abs(ringArea(river.shape.points))-oldArea)<.01);
  assert.deepEqual(fixture,original);assert.equal(upgradeWorldWater(fixed),fixed);
  for(const p of reconcileWater({...fixture,locations:[...fixture.locations].reverse()}).locations) {
    assert.ok(fixed.locations.some(q=>q.id===p.id));
  }
});
test('adjacent polygons join across subdivided edges without selecting an island',()=>{
  const fixed=reconcileWater(map([
    polygon('a',ring(10,10,30,60),'river',[ring(20,30,10,10)]),
    polygon('b',ring(40,10,20,30)),polygon('c',ring(40,40,20,30)),
    line('covered',[[15,15],[50,15]])
  ]));validateMap(fixed);assert.equal(fixed.locations.length,1);
  const p=fixed.locations[0];assert.equal(p.shape.holes.length,1);
  assert.ok(!contains(p,25,35));assert.ok(contains(p,50,20));assert.ok(contains(p,50,60));
});
test('separate lakes, point contacts, different water types and named tributaries remain distinct',()=>{
  const features=[polygon('a',ring(5,5,20,20),'lake'),polygon('b',ring(25,25,20,20),'lake'),polygon('c',ring(60,5,20,20),'lake'),polygon('d',ring(5,25,20,20),'river')];
  const fixed=reconcileWater(map(features));validateMap(fixed);assert.equal(fixed.locations.length,4);
  assert.deepEqual(new Set(fixed.locations.map(p=>p.id)),new Set(features.map(p=>p.id)));
  const a=polygon('main',ring(10,10,20,30)),b=polygon('tributary',ring(30,10,20,30));
  a.worldStyle.sourceName='Main';b.worldStyle.sourceName='Tributary';
  assert.equal(reconcileWater(map([a,b])).locations.length,2);
});
test('covered lines disappear while dry-land crossings and uncovered extensions survive',()=>{
  const p=polygon('bank',ring(10,10,60,60),'river',[ring(30,30,10,10)]);
  const fixed=reconcileWater(map([p,line('inside',[[15,15],[60,15]]),line('island',[[15,35],[60,35]]),line('extension',[[15,60],[80,60]])]));
  validateMap(fixed);assert.equal(fixed.locations.length,3);
  assert.equal(resolveLocationId(fixed,'osm-water-inside'),p.id);
  assert.ok(fixed.locations.some(p=>p.id==='osm-water-island'));assert.ok(fixed.locations.some(p=>p.id==='osm-water-extension'));
});
test('line-only rivers stitch in either direction without bridges over gaps or arbitrary branch joins',()=>{
  const fixed=reconcileWater(map([line('a',[[10,10],[20,10]]),line('b',[[30,10],[20,10]]),line('c',[[30,10],[40,10]]),line('separate',[[60,10],[70,10]])]));
  validateMap(fixed);assert.equal(fixed.locations.length,2);
  const joined=fixed.locations.find(p=>p.shape.points.length===4);assert.ok(contains(joined,35,10));assert.ok(!contains(joined,50,10));
  for(const id of ['a','b','c'])assert.equal(resolveLocationId(fixed,`osm-water-${id}`),joined.id);
  const branched=reconcileWater(map([line('a',[[10,10],[20,10]]),line('b',[[20,10],[30,10]]),line('c',[[20,10],[20,20]])]));
  assert.equal(branched.locations.length,3);
});
test('legacy local imports rebuild indexes, preserve assets and original source, and protect edits',()=>{
  const record={map:fixture,initialMap:structuredClone(fixture),image:new Blob(['image']),thumbnail:new Blob(['thumb']),indexes:localIndexes(fixture)};
  const upgraded=upgradeLocalWater(record);assert.equal(upgraded.map.locations.length,2);assert.equal(upgraded.image,record.image);assert.equal(upgraded.thumbnail,record.thumbnail);
  assert.equal(upgraded.initialMap,record.initialMap);assert.deepEqual(upgraded.indexes,localIndexes(upgraded.map));
  assert.equal(upgradeLocalWater(upgraded),upgraded);
  const edited=structuredClone(record);edited.map.locations[0].overrides={name:'Authored water'};
  assert.equal(upgradeLocalWater(edited),edited);
  assert.equal(upgradeWorldWater({...fixture,worldImport:undefined}).worldImport,undefined);
});
test('context and old links refer to the surviving feature and aliases reject invalid targets',()=>{
  const a=polygon('a',ring(10,10,30,40)),b=polygon('b',ring(40,10,20,40));
  const home={id:'home',category:'home',type:'home',district:'imported-area',x:90,y:90,context:{water:b.id}};
  const fixed=reconcileWater(map([a,b,home]));validateMap(fixed);assert.equal(fixed.locations.find(p=>p.id==='home').context.water,a.id);
  assert.throws(()=>validateMap({...fixed,locationAliases:{old:'absent'}}),/Invalid location alias/);
});
test('prepared and live conversion merge different source IDs before content generation',()=>{
  const g=new PreparedGeometry(15);
  for(const [id,x,points] of [['11',0,ring(4000,100,96,300)],['22',1,ring(0,100,104,300)]])g.add([{id,type:3,extent:4096,layer:'water',properties:{kind:'water',kind_detail:'river',name:'Continuous'},paths:[points]}],16384+x,16384);
  const n=32768,sw=unproject((16384+3900/4096)/n,(16384+500/4096)/n),ne=unproject((16384+4300/4096)/n,(16384+50/4096)/n),bounds={west:sw[0],south:sw[1],east:ne[0],north:ne[1]};
  const elements=g.finish(),options={bounds,width:4096,height:4096,id:'local-water-conversion',name:'Water conversion'};
  assert.equal(elements.length,2);
  const result=convertArea({elements},options).map;validateMap(result);assert.equal(water(result).length,1);assert.equal(result.locations[0].worldStyle.sourceName,'Continuous');
  const geom=points=>points.map(([lon,lat])=>({lon,lat}));
  const live={elements:[{type:'way',id:1,tags:{natural:'water',water:'river'},geometry:geom([[.002,.002],[.005,.002],[.005,.008],[.002,.008],[.002,.002]])},{type:'way',id:2,tags:{natural:'water',water:'river'},geometry:geom([[.005,.002],[.008,.002],[.008,.008],[.005,.008],[.005,.002]])},{type:'way',id:3,tags:{waterway:'river'},geometry:geom([[.003,.005],[.007,.005]])}]};
  assert.equal(convertArea(live,{...options,bounds:{west:0,south:0,east:.01,north:.01}}).map.locations.length,1);
});
