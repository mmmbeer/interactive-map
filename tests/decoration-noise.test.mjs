import test from 'node:test';
import assert from 'node:assert/strict';
import { terrainNoise, valueNoise } from '../public/js/world-maps/decoration-noise.js';
import { planDecorations, markBounds } from '../public/js/world-maps/decoration-plan.js';
import { overlaps } from '../public/js/world-maps/decoration-geometry.js';
const forest=seed=>({width:4096,height:4096,generationId:'noise-regression',generator:{seed},locations:[{
  id:'wood',category:'terrain',type:'forest',worldStyle:{landuse:'wood'},shape:{kind:'polygon',points:[[0,0],[4096,0],[4096,4096],[0,4096]]}
}]});
test('terrain fields are seeded, continuous across lattice edges and independent of export scale',()=>{
  const field=terrainNoise('groves'),same=terrainNoise('groves'),other=terrainNoise('other'),scaled=terrainNoise('groves',.5);
  let changed=0,near=0,far=0;
  for(let y=-500;y<1000;y+=71)for(let x=-500;x<1000;x+=83) {
    const sample=field(x,y);assert.deepEqual(sample,same(x,y));assert.deepEqual(sample,scaled(x*.5,y*.5));
    assert.ok(sample.coverage>=0&&sample.coverage<=1&&sample.scale>0);
    if(sample.coverage!==other(x,y).coverage)changed++;
    near+=Math.abs(sample.coverage-field(x+5,y+5).coverage);
    far+=Math.abs(sample.coverage-field(x+350,y+350).coverage);
  }
  assert.ok(changed>100);assert.ok(near<far*.15,'Neighboring symbols must share spatial context.');
  for(const boundary of [-2,-1,0,1,2])assert.ok(Math.abs(valueNoise(123,boundary-1e-6,.7)-valueNoise(123,boundary+1e-6,.7))<1e-5);
});
test('woodlands contain large clearings and concentrated groves rather than evenly packed symbols',async()=>{
  for(const seed of ['forest-harbor-7','broad-groves','riverside']) {
    const marks=await planDecorations(forest(seed)),bins=Array(256).fill(0);
    for(const m of marks)bins[Math.floor(m.y/256)*16+Math.floor(m.x/256)]++;
    const mean=marks.length/256,variance=bins.reduce((sum,n)=>sum+(n-mean)**2,0)/256;
    const sorted=[...bins].sort((a,b)=>a-b),low=sorted.slice(0,64).reduce((a,b)=>a+b,0),high=sorted.slice(-64).reduce((a,b)=>a+b,0);
    assert.ok(marks.length>500,`${seed}: retain readable woodland coverage`);
    assert.ok(bins.filter(n=>!n).length>25,`${seed}: retain substantial clearings`);
    assert.ok(variance/mean>4,`${seed}: adjacent map areas need different densities`);
    assert.ok(high>low*12,`${seed}: groves must be clearly denser than open land`);
    let touching=0;
    const boxes=marks.map(m=>markBounds(m));
    for(let i=0;i<boxes.length;i++)if(boxes.some((box,j)=>j!==i&&overlaps(box,boxes[i])))touching++;
    assert.ok(touching/marks.length>.2,`${seed}: nearby tree canopies should form thickets`);
  }
});
test('raising tree density thickens the same groves and keeps clearings open on large parcels',async()=>{
  const map=forest('density-control'),sparse=await planDecorations(map,{treeDensity:.5}),normal=await planDecorations(map),dense=await planDecorations(map,{treeDensity:2});
  assert.ok(sparse.length<normal.length&&normal.length<dense.length,'Large parcels must still respond to the density slider.');
  assert.ok(dense.length<=14000);
  // Higher density extends the same seeded candidate stream, keeping existing
  // trees in place and adding neighbors within the same noise field.
  const positions=new Set(dense.map(m=>`${m.x},${m.y}`));
  assert.ok(normal.every(m=>positions.has(`${m.x},${m.y}`)));
});
