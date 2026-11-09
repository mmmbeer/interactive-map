import test from 'node:test';
import assert from 'node:assert/strict';
import { convertArea } from '../public/js/world-maps/model.js';
import { classifyTerrain, parcelMetrics, upgradeLocalTerrain } from '../public/js/world-maps/terrain-context.js';
import { materializeMap } from '../public/js/generation/locations.js';
import { validateMap } from '../public/js/map-contract.js';
import { biomeFor } from '../public/js/world-maps/decoration-plan.js';
const rect=(id,category,type,use,x,y,w,h)=>({id,category,type,district:'imported-area',x:x+w/2,y:y+h/2,
  shape:{kind:'polygon',points:[[x,y],[x+w,y],[x+w,y+h],[x,y+h]]},worldStyle:{kind:category,landuse:use}});
function fixture(waterType='lake') {
  return {id:'local-terrain',schemaVersion:2,name:'Terrain',subtitle:'Terrain test',description:'Import terrain test',theme:'Ink',region:'Test',width:1000,height:1000,image:'map.png',thumbnail:'map.png',
    measurement:{metersPerPixel:1,unit:'m'},generator:{version:2,proseVersion:1,seed:'terrain'},worldImport:{version:1},districts:[{id:'imported-area',name:'Waterside'}],
    locations:[rect('water','water',waterType,'water',0,0,400,1000),rect('strip','terrain','field','grass',402,50,20,900)]};
}
test('long grassy waterfront becomes lakeshore with matching name and prose',()=>{
  const map=fixture(),before=structuredClone(map.locations[1]);classifyTerrain(map);validateMap(map);
  const p=map.locations[1],display=materializeMap(map).locations[1];
  assert.equal(p.type,'lakeshore');assert.equal(p.context.water,'water');assert.equal(biomeFor(p),'meadow');
  assert.match(display.name,/Lakeshore/);assert.doesNotMatch(display.name,/Field/);
  assert.match(display.description,/edge of/);assert.doesNotMatch(display.description,/agricultur|worked|cultivat|slope/i);
  assert.deepEqual(p.shape,before.shape);assert.equal(p.id,before.id);
  const again=fixture();classifyTerrain(again);assert.deepEqual(again,map);
});
test('river and marine banks use appropriate shore labels without inventing beaches or marshes',()=>{
  for(const [water,type] of [['river','riverbank'],['stream','riverbank'],['sea','shore'],['pond','lakeshore']]) {
    const map=fixture(water);classifyTerrain(map);assert.equal(map.locations[1].type,type);
  }
});
test('inland open ground and mapped parks retain plausible non-agricultural uses',()=>{
  for(const [use,type] of [['grass','grassland'],['meadow','meadow'],['park','park'],['garden','garden'],['scrub','scrubland'],['recreation_ground','common']]) {
    const map=fixture();map.locations[1]=rect('open','terrain','field',use,700,200,200,200);
    classifyTerrain(map);validateMap(map);const p=materializeMap(map).locations[1];
    assert.equal(p.type,type);assert.doesNotMatch(p.description,/agricultur|worked|cultivat|slope/i);assert.equal(p.context?.water,undefined);
  }
  const map=fixture();map.locations[1].worldStyle.landuse='park';classifyTerrain(map);assert.equal(map.locations[1].type,'park');
});
test('a broad meadow or one nearby corner does not imply a shoreline strip',()=>{
  const broad=fixture();broad.locations[1]=rect('open','terrain','field','meadow',402,10,500,900);classifyTerrain(broad);
  assert.equal(broad.locations[1].type,'meadow');
  const corner=fixture();corner.locations[0]=rect('water','water','lake','water',0,0,400,40);classifyTerrain(corner);
  assert.equal(corner.locations[1].type,'grassland');
});
test('parcel measurements detect rotated strips and holes rather than trusting bounds',()=>{
  const strip=fixture().locations[1].shape,rotate=([x,y])=>[(x-y)/Math.sqrt(2),(x+y)/Math.sqrt(2)];
  const a=parcelMetrics(strip),b=parcelMetrics({...strip,points:strip.points.map(rotate)});
  assert.ok(Math.abs(a.width-b.width)<1e-9);assert.ok(b.width<24);assert.ok(b.compactness<.22);
  const ring=rect('r','terrain','field','grass',0,0,300,300).shape;ring.holes=[rect('h','terrain','field','grass',10,10,280,280).shape.points];
  assert.ok(parcelMetrics(ring).width<24);
});
test('source farms survive waterside placement and thin land cannot be proposed as a new farm',()=>{
  const options={bounds:{west:0,south:0,east:.01,north:.01},width:1000,height:1000,id:'local-test',name:'Test',settlement:{landFeatures:['farmland','orchard']}};
  const way=(id,tags,x,w)=>({type:'way',id,tags,geometry:[[x,0],[x+w,0],[x+w,.01],[x,.01],[x,0]].map(([lon,lat])=>({lon,lat}))});
  const source={elements:[way(1,{natural:'water',water:'lake'},0,.0095),way(2,{landuse:'farmland'},.0096,.0001)]};
  const map=convertArea(source,options).map;validateMap(map);
  assert.equal(map.locations.find(p=>p.id==='osm-way-2-0').type,'farmland');
  assert.ok(!map.locations.some(p=>p.id.startsWith('fantasy-')));
  assert.ok(map.worldImport.planning.warnings.some(s=>s.includes('No suitable parcel')));
});
test('saved import correction preserves authored fields and edited features without mutating backups',()=>{
  const initialMap=fixture(),record={map:structuredClone(initialMap),initialMap};
  const upgraded=upgradeLocalTerrain(record);assert.equal(upgraded.map.locations[1].type,'lakeshore');
  assert.equal(initialMap.locations[1].type,'field');assert.equal(record.map.locations[1].type,'field');
  assert.equal(upgradeLocalTerrain(upgraded),upgraded);
  for(const change of [p=>p.shape.points[0][0]++,p=>p.overrides={name:'Authored field'},p=>p.type='forest',p=>p.generation={tables:{description:['My text']}}]) {
    const edited=structuredClone(record);change(edited.map.locations[1]);const result=upgradeLocalTerrain(edited);
    assert.deepEqual(result.map.locations[1],edited.map.locations[1]);
  }
  assert.equal(upgradeLocalTerrain({map:{}}).map.worldImport,undefined);
});
test('live source tags preserve beaches, wetlands, woods and distinct open land uses',()=>{
  const uses=[{natural:'beach'},{natural:'wetland'},{natural:'wood'},{natural:'scrub'},{natural:'grassland'},{landuse:'meadow'},{leisure:'park'}];
  const elements=uses.map((tags,i)=>({type:'way',id:i+1,tags,geometry:[[.001+i*.001,.001],[.0018+i*.001,.001],[.0018+i*.001,.003],[.001+i*.001,.003],[.001+i*.001,.001]].map(([lon,lat])=>({lon,lat}))}));
  const options={bounds:{west:0,south:0,east:.01,north:.01},width:1000,height:1000,id:'local-types',name:'Types'};
  const map=convertArea({elements},options).map;validateMap(map);
  assert.deepEqual(map.locations.map(p=>p.type),['beach','marsh','forest','scrubland','grassland','meadow','park']);
});
test('legacy meadow-to-pasture inference is corrected but custom text is preserved',()=>{
  const initialMap=fixture();initialMap.locations[1].type='pasture';initialMap.locations[1].worldStyle.landuse='meadow';
  initialMap.locations[1].generation={settlement:{environment:['farmland'],resources:['pasture']}};
  const record={initialMap,map:structuredClone(initialMap)},result=upgradeLocalTerrain(record);
  assert.equal(result.map.locations[1].type,'lakeshore');assert.equal(result.map.locations[1].generation.settlement,undefined);
  const custom=fixture();custom.locations[1].generation={tables:{description:['An authored description.']}};
  classifyTerrain(custom);assert.equal(custom.locations[1].type,'field');assert.deepEqual(custom.locations[1].generation.tables.description,['An authored description.']);
});
