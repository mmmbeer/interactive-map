import { stableId } from './random.js';
import { canonicalShape } from './geometry.js';
export function addFeature(state,group,type,shape,extra={},category) {
  if(shape.kind==='polygon')shape=canonicalShape(shape,state.precision);
  const road=['majorRoads','roads','cityStreets','paths'].includes(group),building=group==='buildings';
  const at=shape.points[Math.floor(shape.points.length/2)],id=stableId(group.toLowerCase(),[type,shape.points.map(p=>p.map(v=>Math.round(v*state.map.measurement.metersPerPixel*100))),extra.identity||'']);
  const feature={id,category:category||(road?'street':building?'home':group==='water'?'water':'terrain'),type,district:'imported-area',x:at[0],y:at[1],shape,
    worldStyle:{origin:'generated',sourceGroup:group,kind:road?'road':building?'building':group==='water'?'river':'terrain',established:true,layoutVersion:2,...extra}};
  state.map.locations.push(feature);return feature;
}
