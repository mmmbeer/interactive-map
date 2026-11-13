import { chooseRuralPlot } from './rural-engine.js';
import { cutConvex,longestEdgeDeg,Point } from '../../vendor/procedural-engines.js';
import { randomFor } from './random.js';
import { terrainCatalog, landFeatures } from '../settlement-profile.js';
import { parcelMetrics } from '../terrain-context.js';
import { union, shapeGeometry, subtract, intersect, buffer, polygon, polygons, area, interior } from './geometry.js';
import { quarterAt } from './anchors.js';
import { addFeature } from './features.js';
export function finishLandscape(state,needs) {
  const {map,unit,points,mesh}=state;
  const protectedLand=union([...state.parcels.map(p=>buffer(shapeGeometry(p.shape),unit*3)),...state.corridors.map(shapeGeometry),...map.locations.filter(p=>p.worldStyle?.kind==='building'||p.category==='terrain').map(p=>shapeGeometry(p.shape)),...state.reservations.map(r=>r.geometry)]);
  let available=subtract(state.land,protectedLand);
  const voronoi=mesh.voronoi([0,0,map.width,map.height]);
  const patch=(accept)=>{
    const cells=[];
    for(let i=0;i<points.length;i++)if(state.dry[i]&&accept(i)) {
      const ring=voronoi.cellPolygon(i);if(ring)cells.push(polygon(ring.slice(0,-1)));
    }
    if(!cells.length)return [];
    return polygons(intersect(buffer(buffer(union(cells),unit*6),-unit*6),available)).filter(s=>area(shapeGeometry(s))>state.extent**2*.0007);
  };
  const place=(group,type,shape,landuse)=>{
    const p=addFeature(state,group,type,shape,{landuse});const at=interior(shapeGeometry(p.shape));p.x=at[0];p.y=at[1];
    if(type==='field')p.worldStyle.established=false;
    available=subtract(available,shapeGeometry(shape));return p;
  };
  const woodland=()=>{if(needs('woodland')) {
    const shapes=patch(i=>(state.climate?state.climate.biomes[i]==='woodland':state.elevations[i]>.5)&&quarterAt(state,points[i]).distance>state.extent*.13);
    for(const shape of shapes.slice(0,5))place('woodland','forest',shape,'forest');
  }};
  if(state.layoutVersion!==4)woodland();
  for(const green of state.physicalLandscape?.greens||[])if(needs('openland')) {
    const geometry=intersect(shapeGeometry({kind:'polygon',points:green.ring}),available);
    for(const shape of polygons(geometry))if(area(shapeGeometry(shape))>unit*unit*80)place('openland','field',shape,green.purpose==='natural'?'meadow':'common');
  }
  const engineFields=[...(state.physicalLandscape?.fields||[])];
  if(state.layoutVersion===4) {
    const random=randomFor(map,'rural-subdivision-v4'),metric=p=>new Point(p[0]*map.measurement.metersPerPixel,p[1]*map.measurement.metersPerPixel);
    const seed=[[0,0],[map.width,0],[map.width,map.height],[0,map.height]].map(metric),queue=[seed];
    for(let i=0;queue.length&&i<1023;i++) {
      const poly=queue.pop(),xs=poly.map(p=>p.x),ys=poly.map(p=>p.y),size=(Math.max(...xs)-Math.min(...xs))*(Math.max(...ys)-Math.min(...ys));
      if(size>15000&&poly.length>=3){queue.push(...cutConvex(poly,longestEdgeDeg(poly),.35+random()*.3,2));continue;}
      engineFields.push({ring:poly.map(p=>[p.x/map.measurement.metersPerPixel,p.y/map.measurement.metersPerPixel])});
    }
  }
  for(const type of state.profile.landFeatures) {
    if(map.locations.some(p=>p.type===type||p.worldStyle?.landuse===type||type==='graveyard'&&(p.type==='cemetery'||p.worldStyle?.landuse==='cemetery')))continue;
    let shape=state.layoutVersion===4?chooseRuralPlot(state,engineFields,available):null;
    if(!shape)shape=patch(i=>quarterAt(state,points[i]).distance>state.extent*.18&&state.elevations[i]<.68)
      .find(s=>{const m=parcelMetrics(s);return m.width*map.measurement.metersPerPixel>=24&&m.compactness>.18&&(state.layoutVersion!==4||m.area*map.measurement.metersPerPixel**2<=20000);});
    if(!shape){state.warnings.push(`No suitable accessible parcel was available for ${landFeatures[type].toLowerCase()}.`);continue;}
    if(type!=='graveyard')terrainCatalog(map,type,type==='farmland'?'farmland':type);
    const p=place(type==='graveyard'?'burial':'farmland',type,shape,type==='graveyard'?'cemetery':type);
    if(type==='graveyard'){p.category='landmark';p.worldStyle.kind='burial';}
    else p.generation={settlement:{environment:['farmland'],resources:type==='pasture'?['pasture','livestock']:type==='orchard'?['fruit','orchard']:['farmland','grain']}};
  }
  if(state.layoutVersion===4)woodland();
  if(needs('openland'))for(const shape of patch(i=>quarterAt(state,points[i]).distance>state.extent*.2&&state.elevations[i]<.6).slice(0,3))place('openland','field',shape,'meadow');
  if(needs('openland'))for(const reservation of state.reservations.filter(r=>r.role==='market'))for(const shape of polygons(intersect(reservation.geometry,state.land)))place('openland','field',shape,'common');
}
