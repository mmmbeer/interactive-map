import { outlineEngineRoof } from './engine-roofs.js';
import { createSettlementModel } from '../../vendor/procedural-engines.js';
import { earcut } from '../../vendor/planner.js';
import { contains, boundsFor } from '../../geometry.js';
import { seedNumber } from '../procedural-space.js';
import { housingTarget } from './parcels.js';
import { randomFor, stableId, roundPoint } from './random.js';
import { shapeGeometry, polygons, subtract, intersect, buffer, area, interior, distance, project, union, rectangle, polygon } from './geometry.js';
import { addFeature } from './features.js';
import { spatialIndex } from '../decoration-geometry.js';
// Water polygons can contain islands. SettleMaker accepts simple filled rings:
// triangulate holes without changing the union, never send a hole as water.
export function filledWaterRings(shapes) {
  return shapes.flatMap(shape=>{
    if(!shape.holes?.length)return [shape.points];
    const rings=[shape.points,...shape.holes],flat=rings.flat(1).flat(),holes=[];let offset=rings[0].length;
    for(const ring of rings.slice(1)){holes.push(offset);offset+=ring.length;}
    const triangles=earcut(flat,holes,2),points=rings.flat(1),result=[];
    for(let i=0;i<triangles.length;i+=3)result.push(triangles.slice(i,i+3).map(j=>points[j]));
    return result;
  });
}
const ruralTypes=['hamlet','village','farming_village','forest_hold','mining_outpost','caravan_stop'];
export function canPlanSettlement(state,needs) {
  return needs('buildings')&&!state.map.locations.some(p=>p.category==='street'||p.worldStyle?.kind==='building'||p.category==='terrain'&&p.worldStyle?.origin!=='generated')&&state.anchors.length>0;
}
export function planPhysicalSettlement(state,needs,onProgress) {
  const {map,profile}=state,mpp=map.measurement.metersPerPixel,origin=state.anchors.find(a=>a.role==='market').point;
  const metric=v=>Math.round(v*1e5)/1e5;
  const local=p=>({x:metric((p[0]-origin[0])*mpp),y:metric((p[1]-origin[1])*mpp)});
  const image=p=>roundPoint([origin[0]+p.x/mpp,origin[1]+p.y/mpp],state.precision);
  const water=polygons(union(map.locations.filter(p=>p.category==='water').map(p=>shapeGeometry(p.shape))));
  const random=randomFor(map,'engine-approaches-v4'),bearings=state.anchors.filter(a=>a.role==='gate').map(a=>(Math.atan2(a.point[0]-origin[0],origin[1]-a.point[1])*180/Math.PI+360)%360);
  while(bearings.length<(ruralTypes.includes(profile.type)?3:4))bearings.push((random()*360));
  const target=housingTarget(state),preset=ruralTypes.includes(profile.type)?'village':'city',occupancy=profile.householdSize||4;
  // Unknown land outside the cutout is excluded from housing, not assumed dry.
  const outside=polygons(subtract(rectangle(-map.width,-map.height,map.width*3,map.height*3),rectangle(0,0,map.width,map.height)));
  const input={name:map.generationId,population:Math.max(4,target*occupancy),port:profile.type==='port',citadel:profile.type==='fortress',walls:profile.type==='fortress',
    plaza:profile.features.includes('market'),temple:profile.features.includes('temple')||profile.type==='monastery',shanty:false,capital:profile.type==='metropolis',
    roadBearings:bearings.map(bearing_deg=>({bearing_deg,kind:'town'})),biome:profile.environment.includes('desert')?'desert':'temperate',
    coastlineGeometry:filledWaterRings([...water,...outside]).map(ring=>ring.map(local))};
  const seed=seedNumber(`${map.generationId}:${map.generator.seed}:settlemaker-v4`),options={seed,development:{preset,centreOccupancy:occupancy,edgeOccupancy:occupancy},
    onStageTiming:({stage})=>onProgress?.(stage==='landscape'?'Planning gardens, crofts and commons…':'Growing medieval streets and housing…')};
  const model=createSettlementModel(input,options),layers=model.scene.layers;
  state.physicalEngine={name:'settlemaker',version:'4.0.0',revision:model.generatorRevision,seed,input,options:{development:options.development},
    origin,meterScale:mpp,residents:structuredClone(model.residents),diagnostics:[...model.diagnostics],degradedFlags:model.degradedFlags,
    districts:model.districts.map(d=>({...d,boundary:d.boundary.map(image)})),rejectedRoadSegments:0};
  const symbols=new Map(layers.symbols.filter(s=>s.buildingId).map(s=>[s.buildingId,s]));
  state.physicalBuildings=layers.buildings.map(b=>({...b,ring:b.ring.map(image),glyph:symbols.get(b.id)?.id,account:model.buildings.find(a=>a.id===b.id)}));
  state.physicalLandscape={fields:layers.fields.map(f=>({...f,ring:f.ring.map(image)})),greens:layers.greens.map(g=>({...g,ring:g.ring.map(image)}))};
  state.reservations=[];state.routes=[];state.curvedStreets=false;state.keepStreetGeometry=true;
  const groups={artery:'majorRoads',road:'roads',alley:'cityStreets'};
  for(const road of layers.roads) {
    const group=road.role==='service'?'paths':road.role==='approach'?'roads':groups[road.kind],allowed=needs(group)?group:['cityStreets','roads','majorRoads','paths'].find(needs);
    if(!allowed)continue;
    const width=(road.width||3)/mpp,path=road.path.map(image);let chunk=[];
    const flush=()=>{if(chunk.length>1)state.routes.push({points:chunk,width,group:allowed,origin:'generated',role:road.role==='service'?'alley':undefined});chunk=[];};
    for(let i=1;i<path.length;i++) {
      if(distance(path[i-1],path[i])<state.precision)continue;
      if(state.clear([path[i-1],path[i]],width)){if(!chunk.length)chunk.push(path[i-1]);chunk.push(path[i]);}
      else{flush();state.physicalEngine.rejectedRoadSegments++;}
    }
    flush();
  }
  // Crossings stay explicit; they are never discarded as ordinary wet streets.
  for(const bridge of layers.bridges||[]) {
    const path=bridge.path.map(image),width=bridge.width/mpp;
    if(path.some(p=>p[0]<0||p[0]>map.width||p[1]<0||p[1]>map.height))continue;
    const crosses=map.locations.find(p=>p.category==='water'&&path.some(q=>contains(p,...q)));
    if(!crosses)continue;
    addFeature(state,'roads','bridge',{kind:'polyline',points:path,width},{bridge:true,crosses:crosses.id,engine:'settlemaker'});
  }
  state.routeMetrics={engine:'settlemaker',candidateSites:model.districts.length,acceptedRoutes:state.routes.length};
}
export function importPhysicalBuildings(state,graph) {
  const {map,unit,precision}=state,index=spatialIndex(state.extent/24);
  for(const p of map.locations.filter(p=>p.category==='water'||p.category==='street'||p.worldStyle?.kind==='building'||p.category==='terrain'&&p.worldStyle?.origin!=='generated'))index.add(p,boundsFor(p));
  const inside=buffer(state.land,-unit*.5),plots=[];let built=0,rejected=0;const rejectionReasons={land:0,collision:0,access:0};
  for(const b of state.physicalBuildings) {
    const roof=outlineEngineRoof(state,b),shape=polygons(buffer(shapeGeometry(roof.shape),-.12/map.measurement.metersPerPixel))[0];
    if(!shape){rejected++;continue;}
    const geometry=shapeGeometry(shape),box=boundsFor({shape}),at=interior(geometry);
    if(!at||area(geometry)<unit*unit*25||area(subtract(geometry,inside))>precision**2*8){rejected++;rejectionReasons.land++;continue;}
    if([...index.query(box)].some(p=>area(intersect(geometry,shapeGeometry(p.shape)))>precision**2*8)){rejected++;rejectionReasons.collision++;continue;}
    let nearest;
    for(const e of graph.edges)for(let i=1;i<e.points.length;i++) {
      const q=project(at,e.points[i-1],e.points[i]),d=distance(at,q);
      if(!nearest||d<nearest.distance)nearest={edge:e,point:q,distance:d};
    }
    if(!nearest||nearest.distance*map.measurement.metersPerPixel>65){rejected++;rejectionReasons.access++;continue;}
    const plotGeometry=intersect(buffer(geometry,unit),inside),plotShape=polygons(plotGeometry)[0];
    const block=state.blocks.find(block=>contains({shape:block.shape},...at));
    const id=stableId('engine-plot',b.id),plot={id,shape:plotShape,geometry:plotGeometry,block:block?.id,edge:nearest.edge.id,street:nearest.edge.streetIds[0],front:nearest.point,quarter:0,role:b.kind};
    const home=addFeature(state,'buildings','home',shape,{engine:'settlemaker',engineId:b.id,buildingForm:roof.form,engineGlyph:b.glyph,parcel:id,block:block?.id,
      urbanRole:b.account?.settlementRole||b.kind,urbanity:b.account?.urbanity,capacity:b.account?.capacity||0,residents:b.account?.residents||0});
    home.x=at[0];home.y=at[1];home.context={street:plot.street};plot.building=home.id;plots.push(plot);index.add(home,box);built++;
  }
  state.parcels=plots;state.buildingCount=built;state.buildingTarget=housingTarget(state);
  state.physicalEngine.rejectionReasons=rejectionReasons;state.physicalEngine.acceptedBuildings=built;state.physicalEngine.rejectedBuildings=rejected;
  const homes=map.locations.filter(p=>p.worldStyle?.engine==='settlemaker'&&p.worldStyle?.kind==='building');
  const assigned=homes.reduce((sum,p)=>sum+(p.worldStyle.residents||0),0);
  state.physicalEngine.acceptedResidents={requested:state.physicalEngine.residents.requested,assigned,unassigned:state.physicalEngine.residents.requested-assigned};
  if(built<state.buildingTarget*.6)state.warnings.push(`The medieval planner placed ${built} of about ${state.buildingTarget} buildings within this cutout. Retained terrain and street access limit capacity.`);
}
