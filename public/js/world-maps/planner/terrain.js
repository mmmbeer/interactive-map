import { Delaunay, PoissonDiskSampling, createNoise2D } from '../../vendor/planner.js';
import { contains } from '../../geometry.js';
import { blockers, routeClear } from '../procedural-space.js';
import { randomFor, unitFor, precisionFor, roundPoint } from './random.js';
import { rectangle, shapeGeometry, subtract, union, setPrecision } from './geometry.js';
export function createTerrain(map,profile) {
  const unit=unitFor(map),precision=precisionFor(map),extent=Math.max(map.width,map.height),pad=Math.min(unit*24,Math.min(map.width,map.height)/8);
  setPrecision(precision);
  const noise=createNoise2D(randomFor(map,'terrain')),wet=map.locations.filter(p=>p.category==='water');
  const height=(x,y)=>{
    const a=x/extent,b=y/extent,wx=a+noise(a*2.1,b*2.1)*.18,wy=b+noise(a*2.1+17,b*2.1)*.18;
    return .48+.25*noise(wx*3.3,wy*3.3)+.09*noise(wx*9,wy*9)+.025*noise(a*26,b*26);
  };
  const spacing=extent/35,sampler=new PoissonDiskSampling({shape:[map.width-pad*2,map.height-pad*2],minDistance:spacing,maxDistance:spacing*1.5,tries:12},randomFor(map,'terrain-sites'));
  const points=sampler.fill().map(p=>roundPoint([p[0]+pad,p[1]+pad],precision));
  const mesh=Delaunay.from(points),neighbors=points.map((_,i)=>[...mesh.neighbors(i)].sort((a,b)=>a-b));
  const water=points.map(p=>wet.some(w=>contains(w,...p))),space=blockers(map),dry=points.map((p,i)=>!water[i]&&space.free([p[0]-unit,p[1]-unit,unit*2,unit*2]));
  const elevations=points.map((p,i)=>water[i]?-.05:height(...p));
  const waterGeometry=union(wet.map(p=>shapeGeometry(p.shape)));
  const land=subtract(rectangle(pad/2,pad/2,map.width-pad,map.height-pad),waterGeometry);
  return {map,profile,unit,precision,extent,spacing,points,mesh,neighbors,water,dry,elevations,height,land,waterGeometry,
    space,clear:(points,width=unit*8)=>routeClear(points,width,space),channels:[],anchors:[],quarters:[],reservations:[],warnings:[]};
}
export function updateRoadSpace(state) {
  state.space=blockers(state.map);state.clear=(points,width=state.unit*8)=>routeClear(points,width,state.space);
  state.links=state.points.map((p,i)=>state.dry[i]?state.neighbors[i].filter(j=>state.dry[j]&&state.clear([p,state.points[j]],state.unit*11)):[]);
}
