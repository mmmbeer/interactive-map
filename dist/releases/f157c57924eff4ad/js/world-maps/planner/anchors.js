import { distance, read, buffer } from './geometry.js';
import { randomFor, stableId } from './random.js';
const populations={hamlet:28,village:65,farming_village:85,town:200,city:480,metropolis:850,port:380,mining_outpost:45,forest_hold:95,fortress:115,monastery:50,academy:125,caravan_stop:36,undercity:230};
export function planAnchors(state) {
  const {points,dry,elevations,map,unit}=state,random=randomFor(map,'founding');
  const homes=map.locations.filter(p=>p.worldStyle?.kind==='building');
  const center=homes.length?[homes.reduce((s,p)=>s+p.x,0)/homes.length,homes.reduce((s,p)=>s+p.y,0)/homes.length]:[map.width*.5,map.height*.5];
  const candidates=points.map((p,i)=>({p,i})).filter(({i})=>dry[i]&&state.clear([points[i]],unit*12));
  if(!candidates.length)return;
  const pick=score=>[...candidates].sort((a,b)=>score(a)-score(b)||a.i-b.i)[0];
  const core=pick(({p,i})=>distance(p,center)/state.extent+Math.abs(elevations[i]-.45)*.12);
  state.growthRadius=Math.min(state.extent*.34,Math.sqrt(populations[state.profile.type]||200)*unit*62);
  const radius=state.growthRadius;
  const local=candidates.filter(c=>distance(c.p,core.p)<radius*1.2),localPick=score=>[...local].sort((a,b)=>score(a)-score(b)||a.i-b.i)[0]||core;
  const waterPoints=map.locations.filter(p=>p.category==='water').flatMap(p=>p.shape.points||[]);
  const waterside=({p})=>Math.min(state.extent,...waterPoints.map(q=>distance(p,q)));
  const add=(candidate,role)=>{
    if(state.anchors.some(a=>a.index===candidate.i))return;
    state.anchors.push({id:stableId('anchor',[role,candidate.i]),role,index:candidate.i,point:candidate.p});
  };
  add(core,'market');
  if(state.profile.type==='port'&&waterPoints.length)add(pick(c=>waterside(c)+distance(c.p,core.p)*.2),'harbor');
  if(['fortress','city','metropolis','town'].includes(state.profile.type))add(localPick(({p,i})=>distance(p,core.p)/radius-elevations[i]*.7),'keep');
  if(state.profile.features.includes('temple')||state.profile.type==='monastery')add(localPick(({p,i})=>Math.abs(distance(p,core.p)-radius*.45)/radius-elevations[i]*.08),'temple');
  for(let k=0;k<(['hamlet','village','farming_village'].includes(state.profile.type)?1:2);k++) {
    const angle=random()*Math.PI*2,target=[core.p[0]+Math.cos(angle)*radius,core.p[1]+Math.sin(angle)*radius];
    add(localPick(({p})=>distance(p,target)),'gate');
  }
  const count=Math.min(8,state.profile.districtCount||({hamlet:1,village:2,farming_village:2,city:5,metropolis:7,port:4})[state.profile.type]||3);
  state.quarters=[{point:core.p,role:'old-core',phase:0,density:1}];
  for(let k=1;k<count;k++) {
    const angle=k/count*Math.PI*2+random()*.7,reach=radius*(.35+random()*.4);
    const target=[core.p[0]+Math.cos(angle)*reach,core.p[1]+Math.sin(angle)*reach];
    const chosen=localPick(({p})=>distance(p,target)-Math.min(...state.quarters.map(q=>distance(p,q.point)))*.15);
    state.quarters.push({point:chosen.p,role:k===1?'craft-quarter':k===2?'outer-homes':'later-quarter',phase:k,density:.5+random()*.35});
  }
  // A market square reserves civic space but does not forbid streets through it.
  if(!homes.length)state.reservations.push({role:'market',geometry:buffer(read({type:'Point',coordinates:core.p}),unit*28)});
  const keep=state.anchors.find(a=>a.role==='keep');
  if(!homes.length&&keep&&['fortress','city','metropolis'].includes(state.profile.type))state.reservations.push({role:'keep',point:keep.point,geometry:buffer(read({type:'Point',coordinates:keep.point}),unit*52)});
}
export function quarterAt(state,point) {
  return state.quarters.map(q=>({...q,distance:distance(point,q.point)})).sort((a,b)=>a.distance-b.distance||a.phase-b.phase)[0]||{phase:0,role:'outer-homes',density:.4,distance:state.extent};
}
