import { Mapgen4, TriangleMesh } from '../../vendor/procedural-engines.js';
import { Delaunator } from '../../vendor/planner.js';
import { contains } from '../../geometry.js';
import { seedNumber } from '../procedural-space.js';
// Mapgen4 owns elevation, wind-driven rainfall and flow. The adapter supplies
// the retained land mask and converts its 1000-unit mesh back to image space.
export function simulateClimate(state,options={}) {
  const {map,extent,spacing}=state,scale=1000/extent,boundary=[];
  for(let i=0;i<32;i++) {
    const t=(i+.5)/32;
    boundary.push([t*map.width,0],[map.width,t*map.height],[(1-t)*map.width,map.height],[0,(1-t)*map.height]);
  }
  const vertices=[...boundary,...state.points].map(p=>p.map(v=>Math.round(v*scale*1e8)/1e8));
  const mesh=new TriangleMesh(TriangleMesh.addGhostStructure({points:vertices,delaunator:Delaunator.from(vertices),numBoundaryPoints:boundary.length}));
  const config={windAngle:options.windAngle??seedNumber(`${map.generator.seed}:wind`)%360,raininess:options.raininess??.9,rainShadow:.5,evaporation:.5};
  const peaks=Array.from({length:mesh.numSolidTriangles},(_,t)=>t).sort((a,b)=>state.height(mesh.x_of_t(b)/scale,mesh.y_of_t(b)/scale)-state.height(mesh.x_of_t(a)/scale,mesh.y_of_t(a)/scale)).slice(0,6);
  const engine=new Mapgen4(mesh,peaks,{spacing:spacing*scale}),size=64,constraints=new Float32Array(size*size);
  const waters=map.locations.filter(p=>p.category==='water');
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const point=[x/(size-1)*extent,y/(size-1)*extent];
    constraints[y*size+x]=waters.some(w=>contains(w,...point))?-.4:state.height(...point);
  }
  engine.assignElevation({seed:seedNumber(`${map.generationId}:${map.generator.seed}:mapgen4`),mountain_jagged:.35,mountain_sharpness:10.5,noisy_coastlines:0,hill_height:.06,ocean_depth:1.4},{constraints,size});
  const points=Array.from({length:mesh.numSolidTriangles},(_,t)=>[mesh.x_of_t(t)/scale,mesh.y_of_t(t)/scale]);
  const water=points.map(p=>waters.some(w=>contains(w,...p)));
  // Exact retained geometry wins over bilinear constraint interpolation.
  for(let t=0;t<mesh.numTriangles;t++)engine.elevation_t[t]=t>=points.length||water[t]?-.4:Math.max(.015,engine.elevation_t[t]);
  engine.assignRegionElevation();
  engine.assignRainfall({wind_angle_deg:config.windAngle,raininess:config.raininess,rain_shadow:config.rainShadow,evaporation:config.evaporation});
  engine.assignRivers({flow:1});
  const downstream=points.map((_,t)=>{const s=engine.s_downslope_t[t],next=s<0?-1:mesh.t_outer_s(s);return next<points.length?next:-1;});
  const elevation=Array.from(engine.elevation_t.slice(0,points.length));
  // Upstream carves plateaus. Condition with a physical epsilon so the saved
  // drainage graph is strictly downhill, including depressions and level reaches.
  for(const t of engine.t_order)if(t<points.length&&downstream[t]>=0)elevation[t]=Math.max(elevation[t],elevation[downstream[t]]+.00001);
  const rainfall=points.map((_,t)=>mesh.r_around_t(t).reduce((sum,r)=>sum+engine.rainfall_r[r],0)/3);
  const moisture=Array.from(engine.moisture_t.slice(0,points.length));
  state.points=points;state.water=water;state.elevations=elevation;
  state.neighbors=points.map((_,t)=>[0,1,2].map(j=>mesh.t_outer_s(t*3+j)).filter(n=>n<points.length).sort((a,b)=>a-b));
  state.dry=points.map((p,i)=>!water[i]&&state.space.free([p[0]-state.unit,p[1]-state.unit,state.unit*2,state.unit*2]));
  state.climate={engine:'mapgen4',config,rainfall,moisture,
    biomes:points.map((_,i)=>water[i]?'water':elevation[i]>.65?'highland':rainfall[i]>.65?'woodland':rainfall[i]<.15?'dry-grassland':'grassland')};
  state.drainage={downstream,flow:Array.from(engine.flow_t.slice(0,points.length)),order:Array.from(engine.t_order).filter(t=>t<points.length)};
  // Landscape Voronoi patches use the same physical samples as climate.
  return state;
}
