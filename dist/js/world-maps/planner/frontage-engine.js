import { planCityBlock,Point,Polygon } from '../../vendor/procedural-engines.js';
import { atDistance,buffer,polygons,shapeGeometry,area,intersect,interior } from './geometry.js';
import { addFeature } from './features.js';
// The host determines frontage from locked source geometry. SettleMaker's block
// solver then fits street rows, detached outskirts and compounds into each lot.
export function buildEngineFrontage(state) {
  const {map,unit}=state,mpp=map.measurement.metersPerPixel;let built=0;
  const rural=['hamlet','village','farming_village','forest_hold'].includes(state.profile.type);
  for(const plot of state.parcels) {
    if(built>=state.buildingTarget)break;
    const inset=polygons(buffer(shapeGeometry(plot.shape),-unit*1.5))[0];if(!inset||inset.holes?.length)continue;
    const center=interior(shapeGeometry(inset)),metric=p=>new Point((p[0]-center[0])*mpp,(p[1]-center[1])*mpp),image=p=>[p.x/mpp+center[0],p.y/mpp+center[1]];
    const site=new Polygon(inset.points.map(metric));if(site.square<0)site.vertices.reverse();
    const edges=inset.points.map((a,i)=>({a,b:inset.points[(i+1)%inset.points.length]}));
    const edge=edges.sort((a,b)=>Math.hypot((a.a[0]+a.b[0])/2-plot.front[0],(a.a[1]+a.b[1])/2-plot.front[1])-Math.hypot((b.a[0]+b.b[0])/2-plot.front[0],(b.a[1]+b.b[1])/2-plot.front[1]))[0];
    const start=edge.a,end=edge.b;
    const streets=[{a:metric(start),b:metric(end),width:1.3,kind:'street'}];
    const grain=rural?95:70,plan=planCityBlock(site,streets,grain,1.3,!rural,true,{gapRatio:rural?.35:.08,groupSize:rural?1:3},!rural);
    if(!plan?.buildings.length)continue;
    for(const [ordinal,proposal] of plan.buildings.entries()) {
      if(built>=state.buildingTarget)break;
      const candidate={kind:'polygon',points:proposal.vertices.map(image)},g=intersect(shapeGeometry(candidate),shapeGeometry(inset)),shape=polygons(g)[0];
      if(!shape||area(shapeGeometry(shape))*mpp*mpp<22)continue;
      const id=`${plot.id}:${ordinal}`,home=addFeature(state,'buildings','home',shape,{engine:'settlemaker-blocks',engineId:id,parcel:plot.id,block:plot.block,
        urbanRole:plot.role,buildingForm:rural?'detached-street-house':'street-row',quarter:plot.quarter});
      const at=interior(shapeGeometry(shape));home.x=at[0];home.y=at[1];home.context={street:plot.street};
      plot.building ||= home.id;(plot.buildings ||= []).push(home.id);built++;
    }
  }
  state.buildingCount=built;
  state.frontageEngine={name:'settlemaker-blocks',version:'4.0.0',buildings:built};
  if(!built)state.warnings.push('No dry street-front plots could accommodate the medieval block solver.');
}
