import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recognizeMap} from '../public/js/local-maps/recognize.js';
import {components,outline,skeleton,paths,area} from '../public/js/local-maps/raster.js';
import {validateMap} from '../public/js/map-contract.js';
import {localIndexes} from '../public/js/local-maps/store.js';
import {materializeMap} from '../public/js/generation/locations.js';
import {contains} from '../public/js/geometry.js';
export function fixture() {
  const w=180,h=140,rgba=new Uint8ClampedArray(w*h*4);
  const rect=(x,y,bw,bh,color)=>{for(let j=y;j<y+bh;j++)for(let i=x;i<x+bw;i++)rgba.set([...color,255],(j*w+i)*4);};
  rect(0,0,w,h,[155,145,120]);rect(83,0,9,h,[235,225,205]);rect(0,68,w,8,[235,225,205]);
  rect(5,5,25,30,[40,140,200]);rect(120,10,35,25,[65,145,60]);
  for(const [x,y] of [[40,30],[60,35],[105,40],[45,95],[110,100]])rect(x,y,8,10,[65,55,45]);
  return {rgba,w,h,width:360,height:280,id:'local-fixture',name:'Fixture',seed:'stable'};
}
test('recognition traces all feature classes in original image coordinates and generates repeatably',()=>{
  const map=recognizeMap(fixture());validateMap(map);
  for(const category of ['home','street','water','terrain'])assert.ok(map.locations.some(p=>p.category===category),category);
  assert.equal(map.locations.filter(p=>p.category==='home').length,5);
  assert.ok(map.districts.filter(d=>d.boundaries).length>=4);
  assert.ok(map.locations.some(p=>p.context?.street));
  const roof=map.locations.find(p=>p.category==='home');assert.ok(contains(roof,88,66));
  const next=recognizeMap(fixture());assert.deepEqual(next,map);
  assert.equal(materializeMap(map).locations[0].name,materializeMap(next).locations[0].name);
  const indexes=localIndexes(map);
  for(const p of map.locations) {
    assert.equal(map.locations[indexes.byId[p.id]].id,p.id);
    assert.ok(indexes.categories[p.category].includes(p.id));assert.ok(indexes.districts[p.district].includes(p.id));
    const cell=`${Math.floor(p.x/indexes.cellSize)},${Math.floor(p.y/indexes.cellSize)}`;
    // Polygon centroids can lie outside concave geometry but are inside its bounds.
    assert.ok(new Map(indexes.cells).get(cell)?.includes(p.id));
  }
});
test('component contours preserve a water island as a hole',()=>{
  const w=30,h=30,mask=new Uint8Array(w*h);
  for(let y=2;y<28;y++)for(let x=2;x<28;x++)mask[y*w+x]=!(x>=10&&x<20&&y>=10&&y<20)?1:0;
  const {labels,items}=components(mask,w,h),rings=outline(labels,w,h,items[0]);
  assert.equal(rings.length,2);assert.ok(area(rings[0])*area(rings[1])<0);
  const p={shape:{kind:'polygon',points:rings[0],holes:[rings[1]]}};
  assert.ok(contains(p,5,5));assert.equal(contains(p,15,15),false);
});
test('road tracing keeps loops and junction branches',()=>{
  const w=40,h=40,mask=new Uint8Array(w*h);
  for(let i=8;i<=30;i++){mask[8*w+i]=1;mask[30*w+i]=1;mask[i*w+8]=1;mask[i*w+30]=1;}
  for(let i=2;i<8;i++)mask[i*w+18]=1;
  const routes=paths(skeleton(mask,w,h),w,h);
  assert.ok(routes.length>=2);assert.ok(routes.some(p=>p.some(v=>v[1]<5)));
});
test('blank artwork does not invent a map with random locations',()=>{
  const input=fixture();input.rgba.fill(255);assert.throws(()=>recognizeMap(input),/No features/);
});
test('edge-clipped routes remain valid at fractional original-image scales',()=>{
  const input=fixture();input.width=3548;input.height=1774;
  const map=recognizeMap(input);assert.doesNotThrow(()=>validateMap(map));
  assert.ok(map.locations.some(p=>p.category==='street'));
});
test('color sampling supports artwork whose water is not blue',()=>{
  const input=fixture();
  for(let y=5;y<35;y++)for(let x=5;x<30;x++)input.rgba.set([170,90,190,255],(y*input.w+x)*4);
  input.options={palette:{water:[170,90,190]},tolerance:20};
  const map=recognizeMap(input);assert.equal(map.locations.filter(p=>p.category==='water').length,1);
});
test('index rebuilds remove deleted locations and preserve unrelated IDs',()=>{
  const map=recognizeMap(fixture()),before=localIndexes(map),id=map.locations.find(p=>p.category==='home').id;
  map.locations=map.locations.filter(p=>p.id!==id);const after=localIndexes(map);
  assert.equal(after.byId[id],undefined);assert.ok(!after.categories.home.includes(id));
  assert.ok(after.cells.every(([,ids])=>!ids.includes(id)));
  for(const p of map.locations)assert.equal(map.locations[after.byId[p.id]].id,p.id);
  assert.ok(Object.hasOwn(before.byId,id));
});
