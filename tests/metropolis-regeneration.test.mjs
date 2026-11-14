import test from 'node:test';
import assert from 'node:assert/strict';
import { convertArea } from '../public/js/world-maps/model.js';
import { regenerateLayout } from '../public/js/world-maps/regeneration.js';
import { applyProfile, normalizeProfile } from '../public/js/world-maps/settlement-profile.js';
import { applyRegionScale } from '../public/js/world-maps/region-scale.js';
import { importPhysicalBuildings } from '../public/js/world-maps/planner/settlement-engine.js';
import { unitFor, precisionFor } from '../public/js/world-maps/planner/random.js';
import { rectangle, shapeGeometry, area, intersect, setPrecision } from '../public/js/world-maps/planner/geometry.js';
import { spatialIndex } from '../public/js/world-maps/decoration-geometry.js';
import { boundsFor } from '../public/js/geometry.js';
import { defaultRegenerationMode, regenerationSummary } from '../public/js/regeneration-summary.js';
import { validateMap } from '../public/js/map-contract.js';
import { peninsulaSource, peninsulaOptions } from './fixtures/peninsula-village.mjs';

test('small physical houses survive city drawing scales and export resolutions',()=>{
  for(const width of [900,2731,4096])for(const extentMeters of [850,3500,6500]) {
    const mpp=extentMeters/width,map={id:'test',generationId:'test',width,height:width,measurement:{metersPerPixel:mpp},generator:{seed:'test'},locations:[]};
    const precision=precisionFor(map);setPrecision(precision);
    const point=([x,y])=>[x/mpp,y/mpp],ring=[[100,100],[108,100],[108,108],[100,108]].map(point);
    const state={map,precision,unit:unitFor(map),extent:width,land:rectangle(0,0,width,width),blocks:[],layoutVersion:4,
      profile:{type:'metropolis'},warnings:[],physicalBuildings:[{id:'small-house',kind:'house',ring,account:{residents:4}}],physicalEngine:{residents:{requested:4}}};
    const graph={edges:[{id:'street',streetIds:['street'],points:[[80,96],[130,96]].map(point)}]};
    importPhysicalBuildings(state,graph);
    assert.equal(state.buildingCount,1,`${width}px at ${extentMeters}m`);
    assert.equal(state.physicalEngine.rejectionReasons.area,0);
    assert.equal(state.physicalEngine.acceptedResidents.assigned,4);
    assert.ok(area(shapeGeometry(map.locations[0].shape))*mpp*mpp>59);
  }
});

test('a peninsula village regenerates as a metropolis with housing, businesses, streets and alleys',()=>{
  const source=convertArea(peninsulaSource,{...peninsulaOptions,width:2731,height:4096,survey:true}).map;
  const profile=applyProfile(source,normalizeProfile(peninsulaOptions.settlement));applyRegionScale(source,profile);
  const before=structuredClone(source),settings={ancestry:'original',seed:'1dd2d7337346ab433ac4b9d4fab366a6',settlementType:'metropolis'};
  const map=regenerateLayout(source,settings).map,counts=regenerationSummary(map),planner=map.worldImport.procedural.planner;
  validateMap(map);assert.deepEqual(source,before);
  assert.equal(map.worldImport.distanceScale.fantasyWidthMeters,6500);
  assert.equal(map.measurement.metersPerPixel,6500/map.width);
  assert.equal(map.worldImport.settlement.type,'metropolis');assert.equal(counts.target,850);
  assert.ok(counts.buildings>=700,JSON.stringify(counts));assert.ok(counts.homes>=400);
  assert.ok(counts.businesses>=150);assert.ok(counts.roads>=100);assert.ok(counts.alleys>=20);
  assert.equal(planner.metrics.buildings,counts.buildings);
  assert.equal(planner.settlement.acceptedResidents.requested,planner.settlement.acceptedResidents.assigned+planner.settlement.acceptedResidents.unassigned);
  for(const p of source.locations)assert.deepEqual(map.locations.find(q=>q.id===p.id).shape,p.shape);
  const index=spatialIndex(map.width/24),tolerance=(planner.precisionMeters/map.measurement.metersPerPixel)**2*10;
  for(const p of map.locations.filter(p=>['water','street'].includes(p.category)))index.add(p,boundsFor(p));
  for(const p of map.locations.filter(p=>p.worldStyle?.kind==='building')) {
    const geometry=shapeGeometry(p.shape),box=boundsFor(p);
    for(const other of index.query(box))assert.ok(area(intersect(geometry,shapeGeometry(other.shape)))<tolerance,`${p.id} intersects ${other.id}`);
    index.add(p,box);
  }
});

test('regeneration defaults to rebuilding imports and reports sparse output separately from terrain',()=>{
  assert.equal(defaultRegenerationMode({worldImport:{bounds:{}}}),'layout');
  assert.equal(defaultRegenerationMode({}),'content');
  const map={districts:[],locations:[{category:'terrain'},{category:'water'},{category:'home',worldStyle:{kind:'building'}},
    {category:'shop',worldStyle:{kind:'building'}},{category:'street',type:'street'},{category:'street',type:'alley'}],
    worldImport:{procedural:{decisions:{buildings:{mode:'generated'}},planner:{metrics:{buildingTarget:850}}},planning:{warnings:['Retained land limits space.']}}};
  const counts=regenerationSummary(map);
  assert.equal(counts.buildings,2);assert.equal(counts.homes,1);assert.equal(counts.businesses,1);
  assert.equal(counts.roads,1);assert.equal(counts.alleys,1);assert.equal(counts.warnings.length,2);
  assert.match(counts.warnings[0],/Only 2 of about 850/);
  assert.equal(regenerationSummary({locations:[{category:'home'},{category:'shop'},{category:'landmark'}]}).buildings,2);
});
