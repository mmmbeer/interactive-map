import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { convertArea } from '../public/js/world-maps/model.js';
import { validateMap } from '../public/js/map-contract.js';
import { normalizeProfile } from '../public/js/world-maps/settlement-profile.js';
import { filledWaterRings } from '../public/js/world-maps/planner/settlement-engine.js';
import { shapeGeometry,area,union,subtract,intersect,setPrecision } from '../public/js/world-maps/planner/geometry.js';
import { spatialIndex } from '../public/js/world-maps/decoration-geometry.js';
import { boundsFor } from '../public/js/geometry.js';
import { peninsulaSource,peninsulaOptions } from './fixtures/peninsula-village.mjs';
import { organicSource,organicOptions } from './fixtures/organic-coast.mjs';
const cached=new Map();
const sample=(key,raw,options)=>{if(!cached.has(key))cached.set(key,convertArea(raw,options).map);return cached.get(key);};
const village=()=>sample('village',peninsulaSource,peninsulaOptions);
const planner=map=>map.worldImport.procedural.planner;
function graphIntegrity(map) {
  const p=planner(map),g=p.streets,nodes=new Map(g.nodes.map(n=>[n.id,n])),edges=new Map(g.edges.map(e=>[e.id,e])),ids=new Set(map.locations.map(f=>f.id));
  assert.equal(nodes.size,g.nodes.length);assert.equal(edges.size,g.edges.length);
  for(const edge of edges.values())for(const id of [edge.from,edge.to])assert.ok(nodes.get(id)?.edges.includes(edge.id));
  for(const node of nodes.values())for(const id of node.edges)assert.ok([edges.get(id)?.from,edges.get(id)?.to].includes(node.id));
  for(const edge of edges.values())assert.ok(edge.streetIds.every(id=>ids.has(id)));
  for(const plot of p.parcels){assert.ok(edges.has(plot.edge));assert.ok(ids.has(plot.street));assert.ok(p.blocks.some(b=>b.id===plot.block));}
}
function clearFootprints(map) {
  const p=planner(map),index=spatialIndex(map.width/24),tolerance=(p.precisionMeters/map.measurement.metersPerPixel)**2*10;
  for(const f of map.locations.filter(f=>['street','water'].includes(f.category)))index.add(f,boundsFor(f));
  const homes=map.locations.filter(f=>f.worldStyle?.kind==='building');
  for(const home of homes) {
    const g=shapeGeometry(home.shape);
    for(const other of index.query(boundsFor(home)))assert.ok(area(intersect(g,shapeGeometry(other.shape)))<tolerance,home.id+' intersects '+other.id);
    assert.ok(home.shape.points.every(([x,y])=>x>=0&&x<=map.width&&y>=0&&y<=map.height));
    index.add(home,boundsFor(home));
  }
}
test('version 4 executes upstream terrain and medieval settlement engines on a peninsula',()=>{
  const map=village(),p=planner(map);validateMap(map);
  assert.equal(p.version,4);assert.equal(p.engines.terrain,'mapgen4');assert.equal(p.engines.streets,'settlemaker');assert.equal(p.engines.buildings,'settlemaker');
  assert.equal(p.settlement.version,'4.0.0');assert.ok(p.passes.includes('medieval-physical-plan'));
  assert.ok(p.metrics.buildings>=48);assert.equal(p.streets.components,1);graphIntegrity(map);clearFootprints(map);
  const forms=new Set(map.locations.filter(f=>f.worldStyle?.engine==='settlemaker').map(f=>f.worldStyle.buildingForm));assert.ok(forms.size>=4);
  const alleys=p.streets.edges.filter(e=>e.role==='alley');assert.ok(alleys.length);
  for(const alley of alleys)for(const id of [alley.from,alley.to])assert.ok(p.streets.nodes.find(n=>n.id===id).edges.length>=2);
  assert.ok(map.locations.some(f=>f.type==='pasture'));
});
test('water decomposition preserves an island instead of flooding the hole',()=>{
  setPrecision(1e-6);
  const shape={kind:'polygon',points:[[0,0],[100,0],[100,100],[0,100]],holes:[[[20,20],[80,20],[80,80],[20,80]]]},pieces=filledWaterRings([shape]);
  const result=union(pieces.map(points=>shapeGeometry({kind:'polygon',points}))),original=shapeGeometry(shape);
  assert.ok(area(subtract(result,original))<1e-7);assert.ok(area(subtract(original,result))<1e-7);assert.equal(Math.round(area(result)),6400);
});
test('Mapgen4 rainfall and downstream flow survive saving and remain acyclic',()=>{
  const p=planner(village()),c=p.climate,n=p.drainage.samples.length;
  assert.equal(c.engine,'mapgen4');assert.equal(c.rainfall.length,n);assert.equal(c.moisture.length,n);assert.equal(c.biomes.length,n);
  assert.ok(c.rainfall.every(x=>Number.isFinite(x)&&x>=0));assert.ok(new Set(c.rainfall.map(x=>x.toFixed(3))).size>20);
  for(const [i,node] of p.drainage.samples.entries()) {
    if(node.downstream>=0)assert.ok(node.elevation>p.drainage.samples[node.downstream].elevation,'non-descending reach '+i);
    let at=i,count=0;while(at>=0){assert.ok(count++<=n);at=p.drainage.samples[at].downstream;}
  }
  assert.deepEqual(JSON.parse(JSON.stringify(village())).worldImport.procedural,village().worldImport.procedural);
});
test('replaying v4 gives byte-identical output without using global randomness',()=>{
  const expected=JSON.stringify(village()),old=Math.random;
  Math.random=()=>{throw new Error('unseeded randomness');};
  try{assert.equal(JSON.stringify(convertArea(peninsulaSource,peninsulaOptions).map),expected);}finally{Math.random=old;}
});
test('export resolution preserves physical streets and buildings',()=>{
  const options={...peninsulaOptions,seed:'physical-v4',settlement:{type:'hamlet'}},a=convertArea(peninsulaSource,{...options,width:900,height:900}).map,b=convertArea(peninsulaSource,options).map;
  const physical=map=>map.locations.filter(f=>f.category==='street'||f.worldStyle?.kind==='building').map(f=>({id:f.id,points:f.shape.points.map(p=>p.map(v=>Math.round(v*map.measurement.metersPerPixel*100)))})).sort((a,b)=>a.id.localeCompare(b.id));
  assert.deepEqual(physical(a),physical(b));
});
test('coastal city uses serviced medieval blocks and reports accepted capacity separately',()=>{
  const map=sample('city',organicSource,organicOptions),p=planner(map);validateMap(map);graphIntegrity(map);clearFootprints(map);
  assert.ok(p.metrics.buildings>=350);assert.ok(p.streets.edges.filter(e=>e.role==='alley').length>8);assert.equal(p.streets.components,1);
  const residents=p.settlement.acceptedResidents;assert.equal(residents.requested,residents.assigned+residents.unassigned);
  assert.ok(residents.assigned<=p.settlement.residents.assigned);assert.equal(p.metrics.buildings,p.settlement.acceptedBuildings);
  assert.ok(p.settlement.districts.length>8);assert.ok(map.locations.some(f=>f.type==='farmland'));assert.ok(map.locations.some(f=>f.type==='pasture'));
});
test('retained streets remain exact while tensor routing and upstream block fitting generate missing features',()=>{
  const way=(id,tags,points)=>({type:'way',id,tags,geometry:points.map(([lon,lat])=>({lon,lat}))});
  const raw={elements:[way(1,{highway:'primary'},[[0,.004],[.009,.004]]),way(2,{highway:'secondary'},[[0,.005],[.009,.005]])]};
  const options={bounds:{west:0,south:0,east:1500/111195,north:1500/111195},width:1200,height:1200,id:'local-retained-engines',name:'Retained routes',seed:'mixed-source',regional:true,settlement:{type:'village'}};
  const original=convertArea(raw,{...options,survey:true}).map,map=convertArea(raw,options).map,p=planner(map);
  assert.equal(p.engines.streets,'probabletrain-tensors-with-constrained-host-graph');assert.equal(p.engines.buildings,'settlemaker-blocks');
  assert.ok(map.locations.some(f=>f.worldStyle?.engine==='settlemaker-blocks'));assert.ok(p.metrics.buildings>25);
  for(const f of original.locations)assert.deepEqual(map.locations.find(p=>p.id===f.id).shape,f.shape);
  for(const key of ['roads','majorRoads'])assert.equal(map.worldImport.procedural.decisions[key].generated,0);
  graphIntegrity(map);clearFootprints(map);
});
test('climate inputs are bounded and changing rainfall changes the upstream climate result',()=>{
  assert.throws(()=>normalizeProfile({procedural:{raininess:NaN}}));assert.throws(()=>normalizeProfile({procedural:{windAngle:360}}));
  assert.throws(()=>normalizeProfile({procedural:{raininess:3}}));
  const options={...peninsulaOptions,settlement:{type:'hamlet',procedural:{raininess:.3,windAngle:0}}},a=convertArea(peninsulaSource,options).map,b=convertArea(peninsulaSource,{...options,settlement:{...options.settlement,procedural:{raininess:1.5,windAngle:0}}}).map;
  assert.notDeepEqual(planner(a).climate.rainfall,planner(b).climate.rainfall);
  const wet=map=>map.locations.filter(f=>f.category==='water'&&f.worldStyle?.origin!=='generated').map(f=>f.shape);assert.deepEqual(wet(a),wet(b));
});
test('installed engine pins and corresponding-source build are explicit',async()=>{
  const lock=JSON.parse(await readFile(new URL('../package-lock.json',import.meta.url),'utf8'));
  assert.equal(lock.packages['node_modules/settlemaker'].version,'4.0.0');assert.ok(lock.packages['node_modules/settlemaker'].integrity);
  const notices=await readFile(new URL('../public/js/vendor/procedural-NOTICES.txt',import.meta.url),'utf8');assert.match(notices,/GPL-3.0/);assert.match(notices,/procedural-source.tar.gz/);
});
