import { Tensor, Grid, Radial, Vector } from '../../vendor/procedural-engines.js';
import { createNoise2D } from '../../vendor/planner.js';
import { randomFor } from './random.js';
import { distance, project } from './geometry.js';
// Uses ProbableTrain's original basis fields and tensor algebra. The host owns
// constrained graph growth, so every retained street remains exact and pinned.
export function createStreetField(state) {
  const noise=createNoise2D(randomFor(state.map,'tensor-noise-v4')),fields=[];
  const core=state.anchors.find(a=>a.role==='market')?.point||[state.map.width/2,state.map.height/2];
  fields.push(new Radial(new Vector(...core),state.extent*.7,1));
  for(const quarter of state.quarters)fields.push(new Grid(new Vector(...quarter.point),state.extent*.45,2,
    Math.atan2(quarter.point[1]-core[1],quarter.point[0]-core[0])+.3));
  const source=state.map.locations.filter(p=>p.category==='street'&&p.worldStyle?.origin!=='generated');
  const field=point=>{
    const at=new Vector(...point),result=Tensor.zero;
    for(const f of fields)result.add(f.getWeightedTensor(at,false),false);
    // Align locally with retained roads, then blend into the settlement field.
    for(const street of source)for(let i=1;i<street.shape.points.length;i++) {
      const a=street.shape.points[i-1],b=street.shape.points[i],d=distance(point,project(point,a,b));
      if(d<state.extent*.12)result.add(Tensor.fromAngle(Math.atan2(b[1]-a[1],b[0]-a[0])).scale((1-d/(state.extent*.12))*2),false);
    }
    result.rotate(noise(point[0]/state.extent*4,point[1]/state.extent*4)*.24);
    return result;
  };
  state.streetField={sample:field,engine:'ProbableTrain/MapGenerator',basisCount:fields.length};
  return state.streetField;
}
export function fieldAlignment(state,a,b) {
  if(!state.streetField)return 0;
  const tensor=state.streetField.sample([(a[0]+b[0])/2,(a[1]+b[1])/2]),major=tensor.getMajor(),minor=tensor.getMinor(),d=distance(a,b);
  if(!d)return 0;
  const dx=(b[0]-a[0])/d,dy=(b[1]-a[1])/d;
  return 1-Math.max(Math.abs(dx*major.x+dy*major.y),Math.abs(dx*minor.x+dy*minor.y));
}
