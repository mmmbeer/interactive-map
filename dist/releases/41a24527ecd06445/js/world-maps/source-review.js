import { sourceGroups, sourceGroup, keepSource } from './source-selection.js';
import { fillShape, contains, distanceToPath } from '../geometry.js';
export function drawSourceReview(canvas,map,selection,trees=[]) {
  const scale=Math.min(1,1000/Math.max(map.width,map.height));
  canvas.width=Math.round(map.width*scale);canvas.height=Math.round(map.height*scale);
  const ctx=canvas.getContext('2d');ctx.scale(canvas.width/map.width,canvas.height/map.height);
  ctx.fillStyle='#f1ede3';ctx.fillRect(0,0,map.width,map.height);
  const order=p=>p.worldStyle?.kind==='building'?3:p.category==='street'?2:p.category==='water'?1:0;
  for(const p of [...map.locations].sort((a,b)=>order(a)-order(b))) {
    ctx.globalAlpha=keepSource(p,selection)?1:.12;ctx.fillStyle=sourceGroups[sourceGroup(p)].color;fillShape(ctx,p);
  }
  ctx.globalAlpha=selection.groups.includes('woodland')?1:.12;ctx.fillStyle=sourceGroups.woodland.color;
  for(const [x,y] of trees){ctx.beginPath();ctx.arc(x,y,Math.max(1.5/scale,map.width/1000),0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;
}
export function sourceAt(map,x,y,selection,tolerance=5) {
  // Ignore disabled groups. Clicking an individually removed item restores it.
  const layer=p=>p.worldStyle?.kind==='building'?3:p.category==='street'?2:p.category==='water'?1:0;
  const hit=[...map.locations].reverse().filter(p=>selection.groups.includes(sourceGroup(p)))
    .sort((a,b)=>layer(b)-layer(a))
    .find(p=>contains(p,x,y)||p.shape.kind==='polyline'&&distanceToPath(p.shape.points,x,y)<=Math.max(tolerance,p.shape.width/2));
  return hit&&sourceGroup(hit)!=='water'?hit:null;
}
