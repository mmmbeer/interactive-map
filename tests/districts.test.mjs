import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { districtAdjacency, districtColors, districtsAdjacent } from '../public/js/district-colors.js';
import { hitTestDistrict } from '../public/js/districts.js';
import { MapStage } from '../public/js/map-stage.js';
const rectangle=(id,x,y,w=10,h=10)=>({id,name:id,boundaries:[{kind:'polygon',points:[[x,y],[x+w,y],[x+w,y+h],[x,y+h]]}]});
test('district adjacency detects shared edges, overlaps, crossings and separate multipart areas',()=>{
  const a=rectangle('a',0,0),b=rectangle('b',10,0),c=rectangle('c',30,0);
  assert.ok(districtsAdjacent(a,b));assert.equal(districtsAdjacent(a,c),false);
  assert.ok(districtsAdjacent(a,rectangle('overlap',5,5)));
  const acrossRoad=districtAdjacency([rectangle('left',0,0,100,100),rectangle('right',101,0,100,100)]);
  assert.ok(acrossRoad.get('left').has('right'));
  assert.ok(districtsAdjacent(rectangle('horizontal',0,4,20,2),rectangle('vertical',9,0,2,10)));
  assert.ok(districtsAdjacent({...a,boundaries:[...a.boundaries,...c.boundaries]},rectangle('remote-neighbor',40,0)));
});
test('all Dragonsgate colors are unique, stable across input order and distinct from adjacent districts',async()=>{
  const {districts}=JSON.parse(await readFile(new URL('../public/data/maps/dragonsgate.json',import.meta.url)));
  const before=JSON.stringify(districts),colors=districtColors(districts),graph=districtAdjacency(districts);
  assert.equal(new Set([...colors.values()].map(c=>c.color)).size,14);
  assert.equal(new Set([...colors.values()].map(c=>c.hue)).size,14);
  assert.deepEqual([...colors].sort(),[...districtColors([...districts].reverse())].sort());
  let edges=0;
  for(const [id,neighbors] of graph)for(const neighbor of neighbors){
    const a=colors.get(id),b=colors.get(neighbor),delta=Math.abs(a.hue-b.hue);
    assert.ok(Math.min(delta,360-delta)>=60,`${id}: ${neighbor}`);edges++;
  }
  assert.ok(edges>20);assert.equal(JSON.stringify(districts),before);
});
test('district hits are fallback-only and respect layer state, boundaries and holes',()=>{
  const a=rectangle('a',0,0);
  assert.equal(hitTestDistrict([a],5,5),a);assert.equal(hitTestDistrict([a],20,20),null);
  assert.equal(hitTestDistrict([a],5,5,{enabled:false}),null);
  for(const category of ['home','street','water','terrain','landmark'])assert.equal(hitTestDistrict([a],5,5,{object:{id:'place',category}}),null);
  const hole={...a,boundaries:[{...a.boundaries[0],holes:[[[2,2],[8,2],[8,8],[2,8]]]}]};
  assert.equal(hitTestDistrict([hole],5,5),null);assert.equal(hitTestDistrict([hole],1,1),hole);
});
test('stage never offers district interaction over a place or with the district layer hidden',()=>{
  const place={id:'visible-pin'},stage={at:()=>place,districtLayer:{enabled:true},callbacks:{selectDistrict(){}}};
  assert.equal(MapStage.prototype.districtAt.call(stage,{x:0,y:0}),null);
  stage.at=()=>null;stage.districtLayer.enabled=false;
  assert.equal(MapStage.prototype.districtAt.call(stage,{x:0,y:0}),null);
});
