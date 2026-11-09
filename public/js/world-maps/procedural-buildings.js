import { boundsFor } from '../geometry.js';
import { layoutUnit, layerRandom, blockers, appendShape } from './procedural-space.js';
const targets={hamlet:28,village:65,farming_village:85,town:200,city:480,metropolis:850,port:380,mining_outpost:45,forest_hold:95,fortress:115,monastery:50,academy:125,caravan_stop:36,undercity:230};
export function generateBuildings(map,profile,warnings) {
  const random=layerRandom(map,'buildings'),unit=layoutUnit(map),space=blockers(map,{roads:true,terrain:true});
  const roads=map.locations.filter(p=>p.category==='street'&&p.shape.kind==='polyline').sort((a,b)=>a.id.localeCompare(b.id));
  const segments=[];let total=0;
  for(const road of roads)for(let i=1;i<road.shape.points.length;i++) {
    const a=road.shape.points[i-1],b=road.shape.points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(length<unit*12)continue;total+=length;segments.push({a,b,length,end:total,width:road.shape.width,road});
  }
  const target=Math.min(targets[profile.type],Math.max(1,Math.floor(map.width*map.height*map.measurement.metersPerPixel**2/300)),Math.max(0,11500-map.locations.length));let placed=0;
  for(let attempt=0;segments.length&&attempt<target*35&&placed<target;attempt++) {
    const pick=random()*total;let lo=0,hi=segments.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(segments[mid].end<pick)lo=mid+1;else hi=mid;}
    const {a,b,length,width,road}=segments[lo],t=.04+random()*.92;
    const along=[(b[0]-a[0])/length,(b[1]-a[1])/length],normal=[-along[1],along[0]],side=random()<.5?-1:1;
    const w=(15+random()*22)*unit,h=(18+random()*27)*unit,offset=width/2+h/2+(4+random()*7)*unit;
    const x=a[0]+(b[0]-a[0])*t+normal[0]*offset*side,y=a[1]+(b[1]-a[1])*t+normal[1]*offset*side;
    const points=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sy])=>[x+along[0]*w/2*sx+normal[0]*h/2*sy,y+along[1]*w/2*sx+normal[1]*h/2*sy]);
    const shape={kind:'polygon',points},box=boundsFor({shape}),pad=unit*3,claim=[box[0]-pad,box[1]-pad,box[2]+2*pad,box[3]+2*pad];
    if(!space.free(claim))continue;
    const p=appendShape(map,'buildings','home',shape,{kind:'building'});p.x=x;p.y=y;p.context={street:road.id};space.claim(claim);placed++;
  }
  if(!placed)warnings.push('No dry, accessible space was available for generated buildings. Change the source choices or choose a region with more usable land.');
  else if(placed<target*.6)warnings.push(`Placed ${placed} of about ${target} planned buildings. Water, terrain and retained features limit the available space.`);
}
