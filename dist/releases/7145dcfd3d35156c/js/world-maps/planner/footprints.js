import { atDistance, polygon, union } from './geometry.js';
// Use local building axes, rather than copying the entire frontage strip.
// Wings and open courts occupy the same plot and share its clearance checks.
export function domesticFootprint(state,plot,random) {
  const {unit}=state,roll=random(),form=plot.frontage>unit*25?(roll<.23?'longhouse':roll<.5?'cottage':roll<.75?'L-house':roll<.91?'T-house':'courtyard'):(roll<.35?'longhouse':'cottage');
  const width=plot.frontage*(.58+random()*.34),depth=Math.min(plot.depth-unit*5,unit*(form==='cottage'?12+random()*17:20+random()*23));
  const margin=(plot.frontage-width)*(.15+random()*.7),center=atDistance(plot.edgePoints,plot.at+margin+width/2);
  const front=plot.setback+unit*(2+random()*(plot.quarter===0?3:9)),[tx,ty]=center.tangent,[x,y]=center.point;
  const point=(across,back)=>[x+tx*across-ty*plot.side*(front+back),y+ty*across+tx*plot.side*(front+back)];
  const rect=(left,top,w,h)=>polygon([point(left,top),point(left+w,top),point(left+w,top+h),point(left,top+h)]);
  let geometry;
  if(form==='L-house')geometry=union([rect(-width/2,0,width,depth*.46),rect(-width/2,0,width*.4,depth)]);
  else if(form==='T-house')geometry=union([rect(-width/2,0,width,depth*.42),rect(-width*.18,0,width*.36,depth)]);
  else if(form==='courtyard')geometry=union([rect(-width/2,0,width,depth*.35),rect(-width/2,0,width*.28,depth),rect(width*.22,0,width*.28,depth)]);
  else geometry=rect(-width/2,0,width,form==='longhouse'?depth:depth*.85);
  return {geometry,form};
}
