import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker as NodeWorker } from 'node:worker_threads';
import { convertArea as convert } from '../public/js/world-maps/model.js';
const convertArea=(data,options)=>convert(data,{...options,layoutVersion:3});
import { buildStreetGraph } from '../public/js/world-maps/planner/topology.js';
import { shapeGeometry, intersect, subtract, area, buffer, line } from '../public/js/world-maps/planner/geometry.js';
import { drawRoads } from '../public/js/world-maps/road-render.js';
import { generateInWorker } from '../public/js/world-maps/worker-client.js';
import { boundsFor } from '../public/js/geometry.js';
import { spatialIndex } from '../public/js/world-maps/decoration-geometry.js';
const options={bounds:{west:0,south:0,east:16,north:16},width:1200,height:1200,id:'local-organic-test',name:'Organic test',seed:'organic-proof',regional:true,settlement:{type:'town',features:['market','temple','tavern']}};
let generated;
const sample=()=>generated ||= convertArea({elements:[]},options).map;
test('noding dissolves partial overlapping spans and splits both sides of a crossing',()=>{
  const map={width:100,height:100,generator:{seed:'nodes'},generationId:'nodes',measurement:{metersPerPixel:1},locations:[]};
  const state={map,unit:1,precision:.001,clear:()=>true,routes:[{points:[[10,50],[50,50],[90,50]],width:2,group:'roads',origin:'generated'},{points:[[25,50],[75,50]],width:2,group:'roads',origin:'generated'},{points:[[50,10],[50,90]],width:2,group:'roads',origin:'generated'}]};
  const graph=buildStreetGraph(state),junction=graph.nodes.find(n=>n.point[0]===50&&n.point[1]===50);
  assert.equal(junction.edges.length,4);assert.equal(graph.edges.length,4);assert.equal(graph.components,1);
  assert.equal(graph.totalLength,160);
});
test('retained lines and bridges preserve their geometry and logical identities',()=>{
  const source={id:'source-road',category:'street',shape:{kind:'polyline',width:3,points:[[10,50],[90,50]]},worldStyle:{sourceGroup:'roads'}};
  const bridge={id:'source-bridge',category:'street',shape:{kind:'polyline',width:3,points:[[50,10],[50,90]]},worldStyle:{sourceGroup:'roads',bridge:true}};
  const map={width:100,height:100,generator:{seed:'nodes'},generationId:'nodes',measurement:{metersPerPixel:1},locations:[structuredClone(source),structuredClone(bridge)]};
  const graph=buildStreetGraph({map,unit:1,precision:.001,clear:()=>true,routes:[]});
  assert.deepEqual(map.locations,[source,bridge]);assert.equal(graph.nodes.some(n=>n.point[0]===50&&n.point[1]===50),false);
});
test('roundoff at a bridge landfall produces one shared graph node',()=>{
  const source={id:'source-road',category:'street',shape:{kind:'polyline',width:3,points:[[10,50],[50,50]]},worldStyle:{sourceGroup:'roads'}};
  const bridge={id:'source-bridge',category:'street',shape:{kind:'polyline',width:3,points:[[50,50+1e-11],[50,90]]},worldStyle:{sourceGroup:'roads',bridge:true}};
  const map={width:100,height:100,generator:{seed:'nodes'},generationId:'nodes',measurement:{metersPerPixel:1},locations:[source,bridge]};
  const graph=buildStreetGraph({map,unit:1,precision:.001,clear:()=>true,routes:[]});
  assert.equal(graph.components,1);assert.equal(graph.nodes.length,3);assert.equal(new Set(graph.nodes.map(n=>n.id)).size,3);
});
test('a bridge landfall splits a ground segment and remains pinned during curve relaxation',()=>{
  const source={id:'source-road',category:'street',shape:{kind:'polyline',width:3,points:[[10,50],[90,50]]},worldStyle:{sourceGroup:'roads'}};
  const bridge={id:'source-bridge',category:'street',shape:{kind:'polyline',width:3,points:[[50,50],[50,90]]},worldStyle:{sourceGroup:'roads',bridge:true}};
  const map={width:100,height:100,generator:{seed:'nodes'},generationId:'nodes',measurement:{metersPerPixel:1},locations:[source,bridge]};
  const graph=buildStreetGraph({map,unit:1,precision:.001,clear:()=>true,routes:[]});
  assert.equal(graph.components,1);assert.equal(graph.nodes.find(n=>n.point[0]===50&&n.point[1]===50).edges.length,3);
});
test('settlements have connected street circuits, diverse bearings and persisted growth stages',()=>{
  const map=sample(),p=map.worldImport.procedural.planner,g=p.streets;
  assert.equal(map.worldImport.procedural.version,3);assert.ok(g.edges.length-g.nodes.length+g.components>4);
  assert.ok(p.passes.includes('blocks-and-frontage'));assert.ok(p.anchors.some(a=>a.role==='market'));
  assert.ok(p.quarters.every(q=>Math.hypot(q.point[0]-p.quarters[0].point[0],q.point[1]-p.quarters[0].point[1])<map.width*.4));
  assert.equal(new Set(g.nodes.map(n=>n.id)).size,g.nodes.length);
  const bearings=new Set(g.edges.map(e=>Math.floor((Math.atan2(e.points.at(-1)[1]-e.points[0][1],e.points.at(-1)[0]-e.points[0][0])+Math.PI)*12/Math.PI)));
  assert.ok(bearings.size>=14);
  const ids=new Set(map.locations.map(p=>p.id));assert.ok(g.edges.every(e=>e.streetIds.every(id=>ids.has(id))));
  assert.ok(p.parcels.every(plot=>ids.has(plot.street)&&p.blocks.some(b=>b.id===plot.block)));
});
test('buildings fit their plots and no footprints overlap water, streets or another building',()=>{
  const map=sample(),p=map.worldImport.procedural.planner,plots=new Map(p.parcels.map(p=>[p.id,p]));
  const index=spatialIndex(map.width/20),obstructions=map.locations.filter(p=>p.category==='water'||p.category==='street');
  for(const feature of obstructions)index.add(feature,boundsFor(feature));
  const tolerance=(p.precisionMeters/map.measurement.metersPerPixel)**2*10;
  const homes=map.locations.filter(p=>p.worldStyle?.kind==='building');assert.ok(homes.length>120);
  for(const home of homes) {
    const geometry=shapeGeometry(home.shape),box=boundsFor(home),plot=plots.get(home.worldStyle.parcel);
    if(plot)assert.ok(area(subtract(geometry,shapeGeometry(plot.shape)))<tolerance,home.id+' outside plot');
    for(const other of index.query(box))assert.ok(area(intersect(geometry,shapeGeometry(other.shape)))<tolerance,home.id+' overlaps '+other.id);
    index.add(home,box);
  }
});
test('conditioned drainage is acyclic, strictly downhill and saved with its channel elevations',()=>{
  const p=sample().worldImport.procedural.planner,vertices=p.drainage.samples;
  assert.ok(p.drainage.channels.length);
  for(const [i,node] of vertices.entries()) {
    if(node.downstream>=0)assert.ok(node.elevation>vertices[node.downstream].elevation,'uphill reach '+i);
    let at=i,steps=0;while(at>=0){assert.ok(steps++<=vertices.length);at=vertices[at].downstream;}
  }
  for(const river of p.drainage.channels) {
    assert.equal(river.points.length,river.elevations.length);
    assert.ok(river.elevations.slice(1).every((z,i)=>z<river.elevations[i]));
  }
});
test('replay is byte-stable and a different seed changes the geometry',()=>{
  const map=sample(),again=convertArea({elements:[]},options).map;
  assert.equal(JSON.stringify(again),JSON.stringify(map));
  const changed=convertArea({elements:[]},{...options,seed:'another-world'}).map;
  assert.notDeepEqual(changed.worldImport.procedural.planner.streets,map.worldImport.procedural.planner.streets);
  assert.deepEqual(JSON.parse(JSON.stringify(map)).locations,map.locations);
});
test('physical geometry stays in place when export resolution changes',()=>{
  const args={...options,settlement:{type:'hamlet'},seed:'export-proof'},a=convertArea({elements:[]},args).map,b=convertArea({elements:[]},{...args,width:2400,height:2400}).map;
  const normalize=map=>map.locations.filter(p=>p.category==='street'||p.worldStyle.kind==='building').map(p=>({id:p.id,points:p.shape.points.map(v=>v.map(x=>Math.round(x*map.measurement.metersPerPixel*100)))}));
  assert.deepEqual(normalize(a),normalize(b));
});
test('road casings are painted before all ordinary interiors and bridges remain on top',()=>{
  const strokes=[],ctx={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},stroke(){strokes.push(this.strokeStyle);}};
  const make=(id,bridge=false)=>({id,shape:{kind:'polyline',width:2,points:[[1,1],[5,5]]},worldStyle:{bridge}});
  drawRoads(ctx,[make('a'),make('b'),make('bridge',true)],1,'#222');
  assert.deepEqual(strokes,['#a4a18e','#a4a18e','#fbfaf4','#fbfaf4','#222','#fbfaf4']);
});
test('worker output matches direct generation and cancellation terminates the worker',async()=>{
  const previous=globalThis.Worker,instances=[];
  class BrowserWorker {
    constructor(url) {
      const code=`import {parentPort} from 'node:worker_threads';self={postMessage:data=>parentPort.postMessage(data)};parentPort.on('message',data=>self.onmessage({data}));await import(${JSON.stringify(url.href)});`;
      this.thread=new NodeWorker(new URL('data:text/javascript,'+encodeURIComponent('globalThis.self={};'+code)));
      this.thread.on('message',data=>this.onmessage?.({data}));this.thread.on('error',error=>this.onerror?.({message:error.message}));instances.push(this);
    }
    postMessage(data){this.thread.postMessage(data);}
    terminate(){this.terminated=true;this.thread.terminate();}
  }
  globalThis.Worker=BrowserWorker;
  try {
    const args={...options,layoutVersion:3,settlement:{type:'hamlet'}},stages=[];
    const actual=await generateInWorker({elements:[]},args,{onProgress:s=>stages.push(s)});
    assert.equal(JSON.stringify(actual.map),JSON.stringify(convertArea({elements:[]},args).map));assert.ok(stages.length>=8);
    const abort=new AbortController(),promise=generateInWorker({elements:[]},args,{signal:abort.signal});abort.abort(new DOMException('Cancelled','AbortError'));
    await assert.rejects(promise,{name:'AbortError'});assert.ok(instances.every(w=>w.terminated));
  } finally {globalThis.Worker=previous;}
});
