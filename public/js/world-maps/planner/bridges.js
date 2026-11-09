import { blockers, routeClear } from '../procedural-space.js';
import { distance, line, buffer, intersect, area, shapeGeometry } from './geometry.js';
import { addFeature } from './features.js';
export const linkKey=(i,j)=>i<j?`${i}:${j}`:`${j}:${i}`;
export function planCrossings(state,needs) {
  state.crossings=new Map();
  const group=['majorRoads','roads','cityStreets','paths'].find(needs);if(!group)return;
  const {map,unit,points}=state,channels=map.locations.filter(p=>p.category==='water'&&p.shape.kind==='polyline'&&['river','stream','canal'].includes(p.type));
  const core=state.anchors.find(a=>a.role==='market')?.point;if(!core||!channels.length)return;
  const existing=map.locations.filter(p=>p.worldStyle?.bridge),candidates=[];
  const ground=blockers({...map,locations:map.locations.filter(p=>!channels.includes(p))});
  for(let i=0;i<points.length;i++)if(state.dry[i]&&state.links[i].length)for(const j of state.neighbors[i]) {
    if(j<=i||!state.dry[j]||!state.links[j].length||state.links[i].includes(j))continue;
    const a=points[i],b=points[j],mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],width=unit*19;
    if(existing.some(p=>distance([p.x,p.y],mid)<state.spacing*3)||!routeClear([a,b],width,ground))continue;
    const touched=channels.filter(p=>area(intersect(buffer(line([a,b]),width/2),shapeGeometry(p.shape)))>unit*unit);
    if(touched.length!==1)continue;
    const channel=touched[0],path=channel.shape.points;
    // Cross the channel, rather than placing a bridge along its bank.
    const dx=b[0]-a[0],dy=b[1]-a[1];let angle=0;
    for(let k=1;k<path.length;k++) {
      const rx=path[k][0]-path[k-1][0],ry=path[k][1]-path[k-1][1];
      angle=Math.max(angle,Math.abs(dx*ry-dy*rx)/(Math.hypot(dx,dy)*Math.hypot(rx,ry)||1));
    }
    if(angle<.55)continue;
    candidates.push({i,j,mid,channel,width,score:distance(mid,core)+distance(a,b)*.2});
  }
  candidates.sort((a,b)=>a.score-b.score||a.i-b.i||a.j-b.j);
  for(const c of candidates) {
    if(state.crossings.size>=2||[...state.crossings.values()].some(p=>distance(p.mid,c.mid)<state.extent*.3))continue;
    const feature=addFeature(state,group,'bridge',{kind:'polyline',points:[points[c.i],points[c.j]],width:c.width},{bridge:true,crosses:c.channel.id});
    state.crossings.set(linkKey(c.i,c.j),{...c,id:feature.id});state.links[c.i].push(c.j);state.links[c.j].push(c.i);
    state.links[c.i].sort((a,b)=>a-b);state.links[c.j].sort((a,b)=>a-b);
  }
}
