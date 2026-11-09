import { createTerrain, updateRoadSpace } from './terrain.js';
import { generateDrainage } from './hydrology.js';
import { planAnchors } from './anchors.js';
import { planCrossings } from './bridges.js';
import { generateRoadCandidates } from './streets.js';
import { buildStreetGraph } from './topology.js';
import { planParcels } from './parcels.js';
import { buildOnParcels } from './buildings.js';
import { finishLandscape } from './landscape.js';
import { compare } from './random.js';
import { seedNumber } from '../procedural-space.js';
import { auditFootprints } from './audit.js';
const versions={planner:2,jsts:'2.12.1',clipping:'0.15.7',delaunay:'6.0.6',noise:'4.0.3',sampling:'2.3.1'};
export function generateOrganicLayout(map,needs,profile,warnings,onProgress) {
  const source=map.locations.map(p=>({id:p.id,shape:p.shape})).sort((a,b)=>compare(a.id,b.id));
  onProgress?.('Shaping terrain…');
  const state=createTerrain(map,profile),passes=['terrain'];
  const labels={drainage:'Tracing watersheds and rivers…','terrain-constraints':'Finding dry routes…','founding-and-growth':'Planning settlement centers…','approved-crossings':'Choosing river crossings…','primary-and-local-streets':'Connecting streets and lanes…','street-topology':'Joining street intersections…','blocks-and-frontage':'Dividing blocks into plots…','building-compounds':'Fitting buildings and courtyards…','landscape-and-rural-plots':'Planting woodland and rural plots…'};
  const run=(name,fn)=>{onProgress?.(labels[name]||'Checking building clearances…');fn();passes.push(name);};
  run('drainage',()=>generateDrainage(state,needs));
  run('terrain-constraints',()=>updateRoadSpace(state));
  run('founding-and-growth',()=>planAnchors(state));
  run('approved-crossings',()=>planCrossings(state,needs));
  run('primary-and-local-streets',()=>generateRoadCandidates(state,needs));
  let graph;
  run('street-topology',()=>{graph=buildStreetGraph(state);});
  run('blocks-and-frontage',()=>planParcels(state,graph));
  if(needs('buildings'))run('building-compounds',()=>buildOnParcels(state));
  run('landscape-and-rural-plots',()=>finishLandscape(state,needs));
  let audit;run('clearance-and-capacity',()=>{audit=auditFootprints(state);});
  warnings.push(...state.warnings);
  const model={version:2,versions,precisionMeters:state.precision*map.measurement.metersPerPixel,
    sourceHash:seedNumber(JSON.stringify(source)).toString(16),passes,
    recipe:{seed:String(map.generator.seed),identity:map.generationId,profile:structuredClone(profile),metersPerPixel:map.measurement.metersPerPixel},
    anchors:state.anchors.map(({index,...a})=>a),quarters:state.quarters,streets:graph,
    blocks:state.blocks.map(({geometry,...b})=>b),parcels:state.parcels.map(({geometry,edgePoints,...p})=>p),
    drainage:{channels:state.channels,conditioned:true,samples:state.points.map((point,i)=>({point,elevation:state.elevations[i],downstream:state.drainage.downstream[i]}))},
    metrics:{...state.routeMetrics,blocks:state.blocks.length,parcels:state.parcels.length,buildings:state.buildingCount||0,components:graph.components,...audit}};
  return model;
}
