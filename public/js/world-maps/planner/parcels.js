import { boundsFor, contains } from '../../geometry.js';
import { spatialIndex } from '../decoration-geometry.js';
import { quarterAt } from './anchors.js';
import { randomFor, stableId, compare } from './random.js';
import { union, shapeGeometry, buffer, line, subtract, intersect, polygons, polygon, area, atDistance, length, canonicalShape } from './geometry.js';
const targets={hamlet:28,village:65,farming_village:85,town:200,city:480,metropolis:850,port:380,mining_outpost:45,forest_hold:95,fortress:115,monastery:50,academy:125,caravan_stop:36,undercity:230};
export function planParcels(state,graph) {
  const {map,unit}=state;
  const water=union(map.locations.filter(p=>p.category==='water').map(p=>shapeGeometry(p.shape)));
  state.land=subtract(state.land,water);
  const roads=union(graph.edges.map(e=>buffer(line(e.points),e.width/2+unit*2)));
  const sourceBuildings=map.locations.filter(p=>p.worldStyle?.kind==='building');
  const obstacles=union([...sourceBuildings.map(p=>buffer(shapeGeometry(p.shape),unit)),...state.reservations.map(r=>r.geometry),...map.locations.filter(p=>p.category==='terrain').map(p=>shapeGeometry(p.shape))]);
  const buildable=subtract(subtract(state.land,roads),obstacles),blocks=polygons(buildable).filter(s=>area(shapeGeometry(s))>unit*unit*40);
  state.blocks=blocks.map(shape=>({id:stableId('block',canonicalShape(shape,state.precision).points.map(p=>p.map(v=>Math.round(v*map.measurement.metersPerPixel*100)))),shape,geometry:shapeGeometry(shape)}));
  state.corridors=polygons(roads);state.parcels=[];
  const index=spatialIndex(unit*100),blockIndex=spatialIndex(state.extent/16);
  state.blocks.forEach(b=>blockIndex.add(b,boundsFor({shape:b.shape})));
  const max=Math.min(targets[state.profile.type]||200,Math.floor(map.width*map.height*map.measurement.metersPerPixel**2/300),Math.max(0,11500-map.locations.length));
  state.buildingTarget=max;
  const frontages=[];
  for(const e of graph.edges)for(const side of [-1,1]) {
    const random=randomFor(map,`frontage:${e.id}:${side}`),total=length(e.points);let at=unit*(3+random()*5);
    while(at<total-unit*10) {
      const center=atDistance(e.points,at).point,q=quarterAt(state,center),rural=['hamlet','village','farming_village','forest_hold'].includes(state.profile.type);
      const frontage=unit*(rural?20+random()*22:q.phase===0?13+random()*13:17+random()*21);
      if(at+frontage>total-unit*3)break;
      frontages.push({edge:e,side,at,frontage,depth:unit*(rural?35+random()*24:q.phase===0?30+random()*22:38+random()*25),q,priority:q.phase+random()*.8});at+=frontage+unit*(rural?3+random()*6:1+random()*2);
    }
  }
  frontages.sort((a,b)=>a.priority-b.priority||compare(a.edge.id,b.edge.id)||a.side-b.side||a.at-b.at);
  for(const f of frontages) {
    if(state.parcels.length>=max*1.08)break;
    const {edge,side,at,frontage,depth}=f;
    const a=atDistance(edge.points,at),b=atDistance(edge.points,at+frontage),setback=edge.width/2+unit*3;
    const offset=(v,d)=>[v.point[0]-v.tangent[1]*side*d,v.point[1]+v.tangent[0]*side*d];
    const points=[offset(a,setback),offset(b,setback),offset(b,setback+depth),offset(a,setback+depth)];
    let candidate=polygon(points);if(area(candidate)<unit*unit*8)continue;
    // Large changes in frontage direction would fold a parcel back on itself.
    if(a.tangent[0]*b.tangent[0]+a.tangent[1]*b.tangent[1]<.25)continue;
    const bbox=boundsFor({shape:{kind:'polygon',points}}),frontPoint=offset(atDistance(edge.points,at+frontage*.5),setback+unit*2);
    const block=[...blockIndex.query(bbox)].find(b=>contains({shape:b.shape},...frontPoint));
    if(!block)continue;
    candidate=intersect(candidate,block.geometry);if(area(candidate)<frontage*depth*.38)continue;
    const near=[...index.query(bbox)];
    if(near.length)candidate=subtract(candidate,union(near.map(p=>p.geometry)));
    const shape=polygons(candidate)[0];if(!shape)continue;
    const footprint=shapeGeometry(shape);if(area(footprint)<unit*unit*110)continue;
    const mid=[(points[0][0]+points[1][0])/2,(points[0][1]+points[1][1])/2];
    if(!contains({shape},...frontPoint))continue;
    const canonical=canonicalShape(shape,state.precision),id=stableId('parcel',[edge.id,side,Math.round(at*map.measurement.metersPerPixel*100)]);
    const parcel={id,block:block.id,street:edge.streetIds[0],edge:edge.id,shape:canonical,geometry:shapeGeometry(canonical),front:mid,frontage,depth,side,quarter:f.q.phase,role:f.q.role,at,edgePoints:edge.points,setback};
    state.parcels.push(parcel);index.add(parcel,boundsFor({shape}));
  }
}
