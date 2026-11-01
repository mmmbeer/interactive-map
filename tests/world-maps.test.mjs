import test from 'node:test';
import assert from 'node:assert/strict';
import { project, unproject, dimensions, frameSize, areaBounds, imageProjection, clipLines, clipRing, checkArea, ringArea } from '../public/js/world-maps/geo.js';
import { convertArea } from '../public/js/world-maps/model.js';
import { polygons } from '../public/js/world-maps/osm.js';
import { coastalWater } from '../public/js/world-maps/coast.js';
import { queryFor, fetchArea } from '../public/js/world-maps/source.js';
import { validateMap } from '../public/js/map-contract.js';
import { materializeMap } from '../public/js/generation/locations.js';
import { contains, boundsFor } from '../public/js/geometry.js';
const bounds={west:0,south:0,east:.01,north:.01};
const geom=points=>points.map(([lon,lat])=>({lon,lat}));
const way=(id,tags,points)=>({type:'way',id,tags,geometry:geom(points)});
const fixture={elements:[
  way(1,{building:'yes'},[[.003,.003],[.004,.003],[.004,.004],[.003,.004],[.003,.003]]),
  way(2,{highway:'residential'},[[-.003,.0041],[.013,.0041]]),
  way(3,{natural:'water'},[[.006,.006],[.012,.006],[.012,.012],[.006,.012],[.006,.006]]),
  way(4,{landuse:'forest'},[[0,0],[.002,0],[.002,.002],[0,.002],[0,0]]),
  way(5,{building:'no'},[[.003,.003],[.004,.003],[.004,.004],[.003,.004],[.003,.003]]),
  {type:'node',id:6,tags:{natural:'tree'},lon:.002,lat:.003}
]};
const options={bounds,width:4096,height:4096,id:'local-test-world',name:'Test settlement'};
test('world projection round-trips and crop dimensions preserve output aspect ratio',()=>{
  for(const point of [[0,0],[-89.384,43.074],[179,80],[-120,-45]]) {
    const actual=unproject(...project(...point));assert.ok(actual.every((n,i)=>Math.abs(n-point[i])<1e-7));
  }
  assert.deepEqual(dimensions('square',4096),[4096,4096]);assert.deepEqual(dimensions('landscape',4800),[4800,3200]);assert.deepEqual(dimensions('portrait',4800),[3200,4800]);
  for(const format of ['square','landscape','portrait']) {
    const frame=frameSize(900,600,format),b=areaBounds(project(0,0),16,frame),toImage=imageProjection(b,...dimensions(format,4800));
    assert.deepEqual(toImage(b.west,b.north),[0,0]);assert.deepEqual(toImage(b.east,b.south),dimensions(format,4800));
  }
});
test('clipping does not invent a connection across separate visible road sections',()=>{
  const lines=clipLines([[-10,50],[50,50],[120,50],[120,80],[50,80],[-10,80]],100,100,2);
  assert.equal(lines.length,2);assert.deepEqual(lines[0],[[2,50],[50,50],[98,50]]);
  assert.ok(lines.flat().every(([x,y])=>x>=2&&x<=98&&y>=2&&y<=98));
  const ring=clipRing([[-20,-20],[40,-20],[40,40],[-20,40]],100,100);assert.equal(Math.abs(ringArea(ring)),1600);
});
test('conversion creates aligned, valid geometry, road context, scale and deterministic content',()=>{
  const a=convertArea(fixture,options),b=convertArea(fixture,{...options,id:'local-another-import'});
  assert.equal(a.map.locations.length,4);assert.equal(a.trees.length,1);assert.ok(a.map.measurement.metersPerPixel>0);
  validateMap(a.map);assert.equal(a.map.locations.find(p=>p.category==='home').context.street,'osm-way-2-0');
  const building=a.map.locations.find(p=>p.category==='home'),projectPoint=imageProjection(bounds,4096,4096);
  assert.ok(contains(building,...projectPoint(.0035,.0035)));assert.ok(!contains(building,...projectPoint(.008,.008)));
  const road=a.map.locations.find(p=>p.category==='street'),[x,y,w,h]=boundsFor(road);assert.ok(x>=0&&y>=0&&x+w<=4096&&y+h<=4096);
  assert.deepEqual(a.map.locations,b.map.locations);assert.equal(a.map.generationId,b.map.generationId);
  assert.equal(materializeMap(a.map).locations.find(p=>p.id===building.id).name,materializeMap(b.map).locations.find(p=>p.id===building.id).name);
});
test('multipolygons stitch outer ways and keep courtyards unselectable without duplicate buildings',()=>{
  const relation={type:'relation',id:10,tags:{type:'multipolygon',building:'yes'},members:[
    {type:'way',ref:11,role:'outer',geometry:geom([[.002,.002],[.008,.002],[.008,.008]])},
    {type:'way',ref:12,role:'outer',geometry:geom([[.002,.002],[.002,.008],[.008,.008]])},
    {type:'way',ref:13,role:'inner',geometry:geom([[.004,.004],[.006,.004],[.006,.006],[.004,.006],[.004,.004]])}
  ]};
  assert.equal(polygons(relation).length,1);
  const {map}=convertArea({elements:[relation,way(11,{building:'yes'},[[.002,.002],[.008,.002],[.008,.008],[.002,.002]])]},options);
  assert.equal(map.locations.length,1);const p=map.locations[0],projectPoint=imageProjection(bounds,4096,4096);
  assert.ok(!contains(p,...projectPoint(.005,.005)));assert.ok(contains(p,...projectPoint(.003,.003)));validateMap(map);
});
test('coastlines put sea on the correct side and preserve islands as holes',()=>{
  const water=coastalWater([[[-10,50],[110,50]]],100,100);assert.equal(water.length,1);
  assert.ok(contains({x:50,y:75,shape:{kind:'polygon',...water[0]}},50,75));
  assert.ok(!contains({x:50,y:75,shape:{kind:'polygon',...water[0]}},50,25));
  const island=coastalWater([[[20,20],[20,80],[80,80],[80,20],[20,20]]],100,100);
  assert.equal(island[0].holes.length,1);assert.ok(!contains({x:0,y:0,shape:{kind:'polygon',...island[0]}},50,50));
});
test('area guards reject world-sized queries and incomplete service responses',async()=>{
  assert.throws(()=>checkArea({west:-180,south:-80,east:180,north:80}),/Zoom in/);
  assert.throws(()=>queryFor({...bounds,west:NaN}),/inside the world/);assert.ok(queryFor(bounds).includes('out geom'));
  const original=globalThis.fetch;
  try {
    globalThis.fetch=async()=>({ok:true,headers:new Headers(),json:async()=>({remark:'runtime error',elements:fixture.elements})});
    await assert.rejects(()=>fetchArea(bounds),/not responding/);
    globalThis.fetch=async()=>({ok:false,status:429});await assert.rejects(()=>fetchArea(bounds),/busy/);
  }finally{globalThis.fetch=original;}
});
