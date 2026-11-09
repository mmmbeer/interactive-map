import { quarterAt } from './anchors.js';
import { randomFor } from './random.js';
import { shapeGeometry, buffer, intersect, subtract, polygons, polygon, union, area, atDistance, interior, rectangle } from './geometry.js';
import { addFeature } from './features.js';
import { types } from '../../generation/catalog-v2.js';
import { roots } from '../../generation/wordbanks-v2.js';
export function buildOnParcels(state) {
  const {unit,map}=state;let built=0;
  for(const keep of state.reservations.filter(r=>r.role==='keep')) {
    const [x,y]=keep.point;
    const ring=subtract(rectangle(x-unit*39,y-unit*32,unit*78,unit*64),rectangle(x-unit*23,y-unit*17,unit*46,unit*34));
    const footprint=polygons(intersect(subtract(ring,union(state.corridors.map(shapeGeometry))),buffer(state.land,-unit*3)))[0];
    if(!footprint||area(shapeGeometry(footprint))<unit*unit*150)continue;
    map.generator.catalog ||= {};map.generator.catalog.types ||= {};
    map.generator.catalog.types.fortified_keep={...types.landmark,label:'fortified keep',nouns:roots.map(root=>`${root} Keep`)};
    const place=addFeature(state,'buildings','fortified_keep',footprint,{urbanRole:'keep'},'landmark'),at=interior(shapeGeometry(footprint));place.x=at[0];place.y=at[1];built++;
    const nearest=state.parcels.find(p=>p.role==='old-core');if(nearest)place.context={street:nearest.street};
  }
  for(const plot of state.parcels) {
    if(built>=state.buildingTarget)break;
    const random=randomFor(map,`building:${plot.id}`),p=atDistance(plot.edgePoints,plot.at),q=atDistance(plot.edgePoints,plot.at+plot.frontage);
    const depth=Math.min(plot.depth-unit*5,unit*(plot.quarter===0?23+random()*18:20+random()*16));
    const off=(v,d)=>[v.point[0]-v.tangent[1]*plot.side*d,v.point[1]+v.tangent[0]*plot.side*d];
    const front=plot.setback+unit*1.5,back=front+depth;
    let shape=polygon([off(p,front),off(q,front),off(q,back),off(p,back)]);
    // Courtyard wings occur on suitable larger plots and stay inside the parcel.
    if(plot.frontage>unit*23&&random()<.28) {
      const r=atDistance(plot.edgePoints,plot.at+plot.frontage*.36);
      shape=union([shape,polygon([off(p,front),off(r,front),off(r,plot.setback+plot.depth-unit*3),off(p,plot.setback+plot.depth-unit*3)])]);
    }
    const inset=buffer(shapeGeometry(plot.shape),-unit*1.3),geometry=intersect(shape,inset),footprint=polygons(geometry)[0];
    if(!footprint||area(shapeGeometry(footprint))<unit*unit*65)continue;
    const place=addFeature(state,'buildings','home',footprint,{parcel:plot.id,block:plot.block,quarter:plot.quarter,urbanRole:plot.role});
    const anchor=interior(shapeGeometry(place.shape));place.x=anchor[0];place.y=anchor[1];
    place.context={street:plot.street};plot.building=place.id;built++;
  }
  if(!built)state.warnings.push('No dry, accessible plots were available for buildings. Try a region with more usable land.');
  else if(built<state.buildingTarget*.6)state.warnings.push(`Placed ${built} of about ${state.buildingTarget} buildings. Retained geography and accessible frontage limit capacity.`);
  state.buildingCount=built;
}
