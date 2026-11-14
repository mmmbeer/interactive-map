import { parcelMetrics } from '../terrain-context.js';
import { shapeGeometry,polygons,intersect,area } from './geometry.js';
// Rank cheap native rings first. Boolean clipping only evaluates a bounded
// shortlist, rather than clipping every agricultural candidate against a city.
export function chooseRuralPlot(state,fields,available) {
  const mpp=state.map.measurement.metersPerPixel,core=state.anchors.find(a=>a.role==='market')?.point||[state.map.width/2,state.map.height/2];
  const candidates=fields.map(field=>{
    const shape={kind:'polygon',points:field.ring},metrics=parcelMetrics(shape),x=field.ring.reduce((s,p)=>s+p[0],0)/field.ring.length,y=field.ring.reduce((s,p)=>s+p[1],0)/field.ring.length;
    return {shape,score:Math.abs(metrics.area*mpp*mpp-7000)/7000+Math.hypot(x-core[0],y-core[1])/state.extent};
  }).sort((a,b)=>a.score-b.score||a.shape.points[0][0]-b.shape.points[0][0]||a.shape.points[0][1]-b.shape.points[0][1]);
  for(const candidate of candidates.slice(0,128))for(const shape of polygons(intersect(shapeGeometry(candidate.shape),available))) {
    const m=parcelMetrics(shape);
    if(m.width*mpp>=24&&m.compactness>.18&&m.area*mpp*mpp<=20000)return shape;
  }
  return null;
}
