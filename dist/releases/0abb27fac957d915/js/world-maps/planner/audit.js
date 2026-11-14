import { boundsFor, contains } from '../../geometry.js';
import { spatialIndex } from '../decoration-geometry.js';
import { shapeGeometry, area, intersect, buffer, polygons, interior } from './geometry.js';
// This is a final independent collision pass over rendered footprints. Each
// synthetic building gets at most one inset repair, then a capacity diagnostic.
export function auditFootprints(state) {
  const {map,unit,precision}=state,index=spatialIndex(state.extent/24),waters=map.locations.filter(p=>p.category==='water'),rejected=new Set();
  let repaired=0;
  for(const p of map.locations.filter(p=>p.category==='water'||p.category==='street'||p.worldStyle?.kind==='building'&&p.worldStyle.layoutVersion!==(state.layoutVersion||2)))index.add(p,boundsFor(p));
  const safe=shape=>{
    const g=shapeGeometry(shape),box=boundsFor({shape});
    if(shape.points.some(([x,y])=>x<0||x>map.width||y<0||y>map.height))return false;
    if(shape.points.some(p=>waters.some(w=>contains(w,...p))))return false;
    return [...index.query(box)].every(p=>area(intersect(g,shapeGeometry(p.shape)))<=precision**2*8);
  };
  for(const p of map.locations.filter(p=>p.worldStyle?.kind==='building'&&p.worldStyle.layoutVersion===(state.layoutVersion||2))) {
    if(!safe(p.shape)) {
      const smaller=polygons(buffer(shapeGeometry(p.shape),-unit*2))[0];
      if(!smaller||area(shapeGeometry(smaller))<unit*unit*45||!safe(smaller)){rejected.add(p.id);continue;}
      p.shape=smaller;const at=interior(shapeGeometry(smaller));p.x=at[0];p.y=at[1];p.worldStyle.insetRepair=true;repaired++;
    }
    index.add(p,boundsFor(p));
  }
  if(rejected.size) {
    map.locations=map.locations.filter(p=>!rejected.has(p.id));state.buildingCount-=rejected.size;
    for(const p of state.parcels){
      if(p.buildings)p.buildings=p.buildings.filter(id=>!rejected.has(id));
      if(rejected.has(p.building)){if(p.buildings?.length)p.building=p.buildings[0];else delete p.building;}
    }
    state.warnings.push(`${rejected.size} constrained building footprints were left open after the final clearance check.`);
  }
  return {repaired,rejected:rejected.size};
}
