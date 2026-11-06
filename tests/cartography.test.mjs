import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { planDecorations, markBounds, biomeFor } from '../public/js/world-maps/decoration-plan.js';
import { decorationSpace, fits, crosses, overlaps } from '../public/js/world-maps/decoration-geometry.js';
import { cartographyMap } from './fixtures/cartography-map.mjs';
test('hand drawn details follow biomes, remain deterministic and leave source geometry untouched',async()=>{
  const map=cartographyMap(),original=structuredClone(map),marks=await planDecorations(map);
  assert.deepEqual(map,original);
  assert.deepEqual(await planDecorations({...map,id:'another-local-id',locations:[...map.locations].reverse()}),marks);
  assert.notDeepEqual(await planDecorations({...map,generator:{seed:'another-seed'}}),marks);
  for(const [region,kinds] of [['wood',['pine','bush']],['marsh',['reeds','ripples']],['cemetery',['graves']],['orchard',['bush']],['pasture',['grass']]]) {
    for(const kind of kinds)assert.ok(marks.some(m=>m.region===region&&m.kind===kind),`${region} needs ${kind}`);
  }
  assert.ok(marks.some(m=>m.harbor==='harbor'&&m.kind==='ship'));
  assert.ok(marks.some(m=>m.ambient));assert.ok(!marks.some(m=>m.region==='farm'));
  assert.ok(new Set(marks.filter(m=>m.region==='wood').map(m=>m.size)).size>20);
  const space=decorationSpace(map,1),byId=new Map(map.locations.map(p=>[p.id,p]));
  for(const mark of marks) {
    const box=markBounds(mark,1);
    assert.ok(space.free(box,!!(mark.harbor||mark.water)),`Obstructed ${mark.kind} at ${mark.x},${mark.y}`);
    if(mark.region)assert.ok(fits(byId.get(mark.region),box),'Full symbol must fit the parcel, including its holes.');
    space.claim(box);
  }
});
test('thin roads, interior holes and concave parcel edges block an entire symbol footprint',()=>{
  assert.ok(crosses([0,50],[100,50],[40,40,20,20]));
  const map=cartographyMap(),space=decorationSpace(map,1);
  assert.ok(!space.free([1150,300,20,20]),'Pond must block vegetation.');
  assert.ok(!space.free([1080,670,20,20]),'Roof must block vegetation.');
  assert.ok(!space.free([120,309,20,30]),'Narrow diagonal road must block vegetation between symbol corners.');
  const shape={kind:'polygon',points:[[0,0],[200,0],[200,200],[0,200]],holes:[[[90,90],[110,90],[110,110],[90,110]]]};
  assert.ok(!fits({shape},[80,80,40,40]),'A hole enclosed entirely by the symbol cannot be missed.');
  shape.holes=[];shape.points=[[0,0],[200,0],[200,200],[100,50],[0,200]];
  assert.ok(!fits({shape},[40,40,120,40]),'All four corners inside does not guarantee the concave edge is clear.');
  const bend={shape:{kind:'polyline',width:15,points:[[0,0],[100,0],[100,100],[0,100]]}};
  assert.ok(!fits(bend,[5,5,90,90]),'A boat cannot bridge a dry peninsula between river segments.');
  assert.ok(fits({shape:{kind:'polyline',width:40,points:[[0,50],[100,50]]}},[30,40,20,20]));
  assert.equal(overlaps([0,0,10,10],[20,20,5,5]),false);
});
test('tree density, mapped trees, cancellation and render budgets are respected',async()=>{
  const map=cartographyMap(),trees=[[300,300],[1150,300],[1100,700],[-20,50]],marks=await planDecorations(map,{trees});
  assert.ok(marks.some(m=>m.mapped&&m.x===300));assert.equal(marks.filter(m=>m.mapped).length,1);
  const zero=await planDecorations(map,{trees,treeDensity:0});
  assert.ok(!zero.some(m=>m.mapped||['wood','orchard'].includes(m.region)));
  assert.ok(zero.some(m=>m.region==='cemetery')&&zero.some(m=>m.region==='marsh')&&zero.some(m=>m.harbor));
  const controller=new AbortController();controller.abort();
  await assert.rejects(planDecorations(map,{signal:controller.signal}),{name:'AbortError'});
  const during=new AbortController(),pending=planDecorations(map,{signal:during.signal});setTimeout(()=>during.abort(),0);
  await assert.rejects(pending,{name:'AbortError'});
  const full={...map,locations:[{...map.locations[0],shape:{kind:'polygon',points:[[0,0],[4096,0],[4096,3072],[0,3072]]}}]};
  assert.ok((await planDecorations(full,{treeDensity:2})).length<=14000);
});
test('imported source types and supplemental burial plots select matching symbol families',()=>{
  assert.equal(biomeFor({type:'graveyard',worldStyle:{kind:'burial',established:true}}),'burial');
  assert.equal(biomeFor({type:'forest',worldStyle:{landuse:'scrub'}}),'scrub');
  assert.equal(biomeFor({type:'field',worldStyle:{landuse:'wetland'}}),'wetland');
  assert.equal(biomeFor({type:'forest',worldStyle:{landuse:'orchard'}}),'orchard');
});
test('bundled symbols carry the original CC0 license and use a local PNG atlas',async()=>{
  const license=await readFile(new URL('../public/assets/cartography/LICENSE.txt',import.meta.url),'utf8');
  assert.match(license,/Creative Commons Zero, CC0/);assert.match(license,/Kenney/);
  const png=await readFile(new URL('../public/assets/cartography/kenney-ink-v1.png',import.meta.url));
  assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);assert.ok(png.length<150000);
});
