import test from 'node:test';
import assert from 'node:assert/strict';
import { convertArea } from '../public/js/world-maps/model.js';
import { peninsulaSource, peninsulaOptions } from './fixtures/peninsula-village.mjs';
import { shapeGeometry, area, length, distance, intersect, subtract, rectangle, setPrecision } from '../public/js/world-maps/planner/geometry.js';
import { trimUnoccupiedStreets } from '../public/js/world-maps/planner/occupancy.js';
import { boundsFor } from '../public/js/geometry.js';
import { spatialIndex } from '../public/js/world-maps/decoration-geometry.js';
let saved;
const sample=()=>saved ||= convertArea(peninsulaSource,peninsulaOptions).map;
test('peninsula village streets follow housing demand and curve between junctions',()=>{
  const map=sample(),p=map.worldImport.procedural.planner,g=p.streets;
  assert.equal(p.version,3);assert.equal(g.components,1);assert.ok(p.metrics.buildings>=60);
  const occupied=new Set(p.parcels.filter(p=>p.building).map(p=>p.edge));
  assert.ok(occupied.size/g.edges.length>.75,'most streets need inhabited frontage');
  assert.ok(g.edges.filter(e=>length(e.points)>50&&length(e.points)/distance(e.points[0],e.points.at(-1))>1.005).length/g.edges.length>.6,'junctions must not force straight segments');
  for(const node of g.nodes.filter(n=>n.edges.length===1)) {
    const edge=g.edges.find(e=>e.id===node.edges[0]);assert.ok(occupied.has(edge.id)||edge.source==='mapped','empty generated branch');
  }
  assert.ok(p.passes.includes('block-alleys'));assert.ok(p.passes.includes('occupied-streets'));
});
test('narrow alleys connect to real street nodes at both ends',()=>{
  const map=sample(),g=map.worldImport.procedural.planner.streets,alleys=g.edges.filter(e=>e.role==='alley');
  assert.ok(alleys.length,'village needs a usable alley');
  for(const alley of alleys) {
    for(const id of [alley.from,alley.to])assert.ok(g.nodes.find(n=>n.id===id).edges.length>=3,'unconnected alley mouth');
    assert.ok(alley.width<g.edges.filter(e=>!e.role).reduce((s,e)=>s+e.width,0)/(g.edges.length-alleys.length));
    assert.ok(alley.points.length>3);assert.ok(alley.streetIds.every(id=>map.locations.find(p=>p.id===id).type==='alley'));
  }
});
test('village footprints vary in form and area while keeping exact clearances',()=>{
  const map=sample(),p=map.worldImport.procedural.planner,homes=map.locations.filter(x=>x.worldStyle?.buildingForm);
  assert.ok(new Set(homes.map(h=>h.worldStyle.buildingForm)).size>=5);
  const areas=homes.map(h=>area(shapeGeometry(h.shape))).sort((a,b)=>a-b);
  assert.ok(areas[Math.floor(areas.length*.9)]/areas[Math.floor(areas.length*.1)]>3);
  const index=spatialIndex(map.width/20),plots=new Map(p.parcels.map(p=>[p.id,p])),blocks=new Set(p.blocks.map(b=>b.id));
  for(const f of map.locations.filter(p=>p.category==='water'||p.category==='street'))index.add(f,boundsFor(f));
  const tolerance=(p.precisionMeters/map.measurement.metersPerPixel)**2*10;
  for(const home of homes) {
    const geometry=shapeGeometry(home.shape),plot=plots.get(home.worldStyle.parcel);
    assert.ok(plot&&blocks.has(plot.block));assert.equal(home.context.street,plot.street);
    assert.ok(area(subtract(geometry,shapeGeometry(plot.shape)))<tolerance);
    for(const other of index.query(boundsFor(home)))assert.ok(area(intersect(geometry,shapeGeometry(other.shape)))<tolerance,home.id+' overlaps '+other.id);
    index.add(home,boundsFor(home));
  }
});
test('village layout replays exactly and several peninsula seeds keep occupied access',()=>{
  assert.equal(JSON.stringify(sample()),JSON.stringify(convertArea(peninsulaSource,peninsulaOptions).map));
  for(const seed of ['tidal-village','north-spit']) {
    const map=convertArea(peninsulaSource,{...peninsulaOptions,seed}).map,p=map.worldImport.procedural.planner;
    assert.equal(p.streets.components,1);assert.ok(p.metrics.buildings>=48,seed+' building capacity');
    const occupied=new Set(p.parcels.filter(p=>p.building).map(p=>p.edge));
    for(const n of p.streets.nodes.filter(n=>n.edges.length===1))assert.ok(occupied.has(n.edges[0]),seed+' empty branch');
    assert.notDeepEqual(p.streets,sample().worldImport.procedural.planner.streets);
  }
});
test('occupancy pass removes an empty branch and redundant loop while retaining mapped access',()=>{
  setPrecision(.001);
  const coords=[[50,50],[150,50],[250,50],[50,150]],pairs=[[0,1],[1,2],[0,3],[3,1]];
  const edges=pairs.map(([a,b],i)=>({id:'edge-'+i,from:'node-'+a,to:'node-'+b,points:[coords[a],coords[b]],width:4,streetIds:['road-'+i],source:i===2?'mapped':'generated'}));
  const locations=edges.map((e,i)=>({id:e.streetIds[0],category:'street',shape:{kind:'polyline',points:e.points,width:e.width},worldStyle:{origin:e.source,sourceGroup:'roads'}}));
  const source=structuredClone(locations[2]);
  const shape={kind:'polygon',points:[[90,58],[130,58],[130,90],[90,90]]},geometry=shapeGeometry(shape);
  locations.push({id:'home',shape,worldStyle:{kind:'building',origin:'generated'},context:{street:'road-0'}});
  const map={width:400,height:400,measurement:{metersPerPixel:1},locations};
  const state={map,unit:1,precision:.001,extent:400,land:rectangle(0,0,400,400),reservations:[],anchors:[{role:'market',point:coords[0]}],buildingCount:1,
    parcels:[{id:'plot',edge:'edge-0',street:'road-0',building:'home',shape,geometry}],routeMetrics:{}};
  const graph={edges,nodes:coords.map((point,i)=>({id:'node-'+i,point,edges:edges.filter(e=>[e.from,e.to].includes('node-'+i)).map(e=>e.id)}))};
  trimUnoccupiedStreets(state,graph);
  assert.deepEqual(graph.edges.map(e=>e.id),['edge-0','edge-2']);assert.equal(graph.components,1);
  assert.equal(state.routeMetrics.removedEmptyStreets,2);assert.deepEqual(map.locations.find(p=>p.id==='road-2'),source);
  assert.ok(state.blocks.some(b=>b.id===state.parcels[0].block));
});
