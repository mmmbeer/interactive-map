import { serviceAlleys } from './service-alleys.js';
import { buildEngineFrontage } from './frontage-engine.js';
import { connectEngineStreets } from './engine-connections.js';
import { Delaunay } from '../../vendor/planner.js';
import { createTerrain,updateRoadSpace } from './terrain.js';
import { simulateClimate } from './climate.js';
import { generateDrainage } from './hydrology.js';
import { planAnchors } from './anchors.js';
import { planCrossings } from './bridges.js';
import { generateRoadCandidates } from './streets.js';
import { buildStreetGraph } from './topology.js';
import { planBlocks,planParcels,housingTarget } from './parcels.js';
import { finishLandscape } from './landscape.js';
import { compare } from './random.js';
import { seedNumber } from '../procedural-space.js';
import { auditFootprints } from './audit.js';
import { cutAlleys } from './alleys.js';
import { trimUnoccupiedStreets } from './occupancy.js';
import { canPlanSettlement,planPhysicalSettlement,importPhysicalBuildings } from './settlement-engine.js';
import { createStreetField } from './tensor-streets.js';
const versions={planner:4,mapgen4:'c1d8cb018a11a8b9e17d59233c36c176429d37eb',settlemaker:'4.0.0',tensor:'f487e4cee321d105d5b0e14258363fa8b4d004ef',jsts:'2.12.1',clipping:'0.15.7',delaunay:'6.0.6',noise:'4.0.3',sampling:'2.3.1'};
export function generateEngineLayout(map,needs,profile,warnings,onProgress) {
  const source=map.locations.map(p=>({id:p.id,category:p.category,type:p.type,shape:p.shape})).sort((a,b)=>compare(a.id,b.id));
  const state=createTerrain(map,profile),passes=[];
  state.layoutVersion=4;state.curvedStreets=true;
  const run=(name,label,fn)=>{onProgress?.(label);fn();passes.push(name);};
  run('terrain-and-climate','Simulating elevation, wind and rainfall…',()=>{simulateClimate(state,profile.procedural);state.mesh=Delaunay.from(state.points);});
  run('drainage','Tracing rain-fed rivers and tributaries…',()=>generateDrainage(state,needs));
  run('terrain-constraints','Finding dry routes…',()=>updateRoadSpace(state));
  run('founding-and-growth','Choosing settlement ground…',()=>planAnchors(state));
  const physical=canPlanSettlement(state,needs);
  if(physical)run('medieval-physical-plan','Growing medieval streets and plots…',()=>planPhysicalSettlement(state,needs,onProgress));
  else {
    run('street-direction-field','Following terrain and retained streets…',()=>createStreetField(state));
    run('approved-crossings','Choosing river crossings…',()=>planCrossings(state,needs));
    run('primary-and-local-streets','Connecting streets and lanes…',()=>generateRoadCandidates(state,needs));
  }
  let graph;
  run('street-topology','Joining street intersections…',()=>{graph=buildStreetGraph(state);if(physical)graph=connectEngineStreets(state,graph);});
  run('blocks-and-frontage','Dividing inhabited ground into blocks…',()=>{planBlocks(state,graph);state.buildingTarget=housingTarget(state);});
  if(physical)run('engine-building-compounds','Importing fitted medieval buildings…',()=>importPhysicalBuildings(state,graph));
  else {
    run('block-alleys','Opening narrow alleys…',()=>{graph=cutAlleys(state,graph,needs);planParcels(state,graph);});
    if(needs('buildings'))run('building-compounds','Fitting buildings to retained streets…',()=>buildEngineFrontage(state));
  }
  // Exact clearance audit precedes occupancy pruning, so removed homes cannot
  // keep speculative roads alive or inflate the saved resident account.
  if(physical)run('block-alleys','Connecting service alleys between buildings…',()=>{graph=serviceAlleys(state,graph,needs);});
  let audit;run('clearance-and-capacity','Checking footprint clearances…',()=>{audit=auditFootprints(state);});
  run('occupied-streets','Checking building access…',()=>{graph=trimUnoccupiedStreets(state,graph);});
  run('landscape-and-rural-plots','Planting woodland and rural plots…',()=>finishLandscape(state,needs));
  if(state.physicalEngine) {
    const homes=map.locations.filter(p=>p.worldStyle?.engine==='settlemaker'&&p.worldStyle?.kind==='building');
    const assigned=homes.reduce((sum,p)=>sum+(p.worldStyle.residents||0),0);
    state.physicalEngine.acceptedBuildings=homes.length;
    state.physicalEngine.acceptedResidents={requested:state.physicalEngine.residents.requested,assigned,unassigned:state.physicalEngine.residents.requested-assigned};
  }
  warnings.push(...state.warnings);
  return JSON.parse(JSON.stringify({version:4,versions,precisionMeters:state.precision*map.measurement.metersPerPixel,
    sourceHash:seedNumber(JSON.stringify(source)).toString(16),passes,
    recipe:{seed:String(map.generator.seed),identity:map.generationId,profile:structuredClone(profile),metersPerPixel:map.measurement.metersPerPixel},
    engines:{terrain:'mapgen4',streets:physical?'settlemaker':'probabletrain-tensors-with-constrained-host-graph',buildings:physical?'settlemaker':'settlemaker-blocks'},
    ...(state.physicalEngine?{settlement:state.physicalEngine}:{}),
    anchors:state.anchors.map(({index,...a})=>a),quarters:state.quarters,streets:graph,
    blocks:state.blocks.map(({geometry,...b})=>b),parcels:state.parcels.map(({geometry,edgePoints,...p})=>p),
    climate:state.climate,drainage:{channels:state.channels,conditioned:true,samples:state.points.map((point,i)=>({point,elevation:state.elevations[i],downstream:state.drainage.downstream[i]}))},
    metrics:{...state.routeMetrics,blocks:state.blocks.length,parcels:state.parcels.length,buildings:state.buildingCount||0,components:graph.components,...audit}}));
}
