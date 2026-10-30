import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateMap} from '../public/js/map-contract.js';
import {contains} from '../public/js/geometry.js';
import {validateDistrictGeometry} from '../public/js/districts.js';
import {materializeMap,resolveLocation} from '../public/js/generation/locations.js';
import {serializeMap} from '../public/js/authoring/model.js';
const source=JSON.parse(await readFile(new URL('../public/data/maps/dragonsgate.json',import.meta.url),'utf8'));
test('the rebuilt survey covers districts, street-linked roofs and the entire coast',()=>{
  validateMap(source);
  assert.equal(source.generator.version,2);
  assert.equal(source.districts.length,14);
  assert.ok(source.districts.every(d=>d.boundaries?.length && d.label));
  const routes=source.locations.filter(p=>p.category==='street');
  assert.ok(routes.length>=900);
  assert.ok(routes.filter(p=>p.type==='bridge').length>=3);
  assert.ok(source.locations.filter(p=>p.type==='island').length>=100);
  const index=new Map(source.locations.map(p=>[p.id,p]));
  const roofs=source.locations.filter(p=>p.id.startsWith('roof-'));
  assert.ok(roofs.length>8000);
  for(const roof of roofs) {
    assert.equal(index.get(roof.context.street)?.category,'street');
    const district=source.districts.find(d=>d.id===roof.district);
    assert.ok(district.boundaries.some(shape=>contains({shape},roof.x,roof.y)),roof.id);
    assert.ok(contains(roof,roof.x,roof.y),`${roof.id} anchor must touch its footprint`);
  }
  for(let n=1;n<=54;n++)assert.ok(index.has(`dg-${String(n).padStart(4,'0')}`),'Keep recognizable landmark links.');
});
test('sea holes exclude island buildings while retaining water hit targets',()=>{
  const sea=source.locations.find(p=>p.id==='water-shattered-sea');
  assert.ok(sea.shape.holes.length>100);
  assert.equal(contains(sea,100,100),true);
  assert.equal(contains(sea,500,700),true);
  assert.equal(contains(sea,307,179),false);
  assert.equal(contains(sea,220,1040),false);
  const box={shape:{kind:'polygon',points:[[0,0],[100,0],[100,100],[0,100]],holes:[[[20,20],[40,20],[40,40],[20,40]]]}};
  assert.equal(contains(box,10,10),true);assert.equal(contains(box,30,30),false);
});
test('district geometry rejects empty, out-of-bounds and collapsed polygons',()=>{
  const d=source.districts[0];
  for(const change of [{boundaries:[]},{label:{x:-1,y:2}},{boundaries:[{kind:'polygon',points:[[1,1],[2,2],[3,3]]}]},{boundaries:[{kind:'polygon',points:[[1,1],[2,2],[9999,3]]}]}]) {
    assert.throws(()=>validateDistrictGeometry({...d,...change},source),/district/);
  }
});
test('district boundaries and water exclusions survive materialization and compact export',()=>{
  const resolved=materializeMap(source);
  assert.deepEqual(resolved.districtAreas,source.districts);
  const saved=JSON.parse(serializeMap(source));
  assert.deepEqual(saved.districts,source.districts);
  assert.deepEqual(saved.locations[0].shape,source.locations[0].shape);
  assert.equal(saved.locations.find(p=>p.id.startsWith('roof-')).name,undefined);
  const roof=source.locations.find(p=>p.category==='home' && p.id.startsWith('roof-'));
  const building=resolveLocation(source,roof);
  const street=resolveLocation(source,source.locations.find(p=>p.id===roof.context.street));
  assert.ok(building.address.endsWith(street.name));
  assert.doesNotMatch(building.name,/Rooms on|Shop|Store/);
});
test('district filtering does not materialize building stories',()=>{
  const m=structuredClone(source);
  const roof=m.locations.find(p=>p.id.startsWith('roof-'));
  let reads=0;roof.overrides={get name(){reads++;return 'Lazy House';}};
  const view=materializeMap(m).locations.find(p=>p.id===roof.id);
  assert.equal(view.districtId,roof.district);
  assert.equal(view.district,m.districts.find(d=>d.id===roof.district).name);
  assert.equal(reads,0);
  assert.equal(view.name,'Lazy House');assert.ok(reads>0);
});
