import { settlementGrid, MinHeap, neighbors } from './settlement-grid.js';
import { components } from '../local-maps/raster.js';
import { decorationSpace } from './decoration-geometry.js';
import { valueNoise } from './decoration-noise.js';
export function seedNumber(value) {let n=2166136261;for(const c of String(value)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
export function layerRandom(map,key) {
  let n=seedNumber(`${map.generationId}:${map.generator.seed}:layout-v1:${key}`);
  return ()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
}
export const layoutUnit=map=>Math.max(map.width/4096,.45/map.measurement.metersPerPixel);
export function heightField(map) {
  const seed=seedNumber(`${map.generationId}:${map.generator.seed}:height-v1`),extent=Math.max(map.width,map.height);
  return (x,y)=>valueNoise(seed,x/extent*3.4,y/extent*3.4)*.72+valueNoise(seed^713,x/extent*9,y/extent*9)*.28;
}
export function planningSpace(map) {
  const grid=settlementGrid(map,144),height=heightField(map),elevations=Float64Array.from({length:grid.w*grid.h},(_,i)=>height(...grid.point(i)));
  const land=grid.water.map((v,i)=>v||grid.occupied[i]?0:1),regions=components(land,grid.w,grid.h,6);
  const areas=regions.items.sort((a,b)=>b.size-a.size||a.id-b.id).slice(0,4);
  return {...grid,elevations,labels:regions.labels,areas};
}
export function nearCells(i,grid) {
  const x=i%grid.w,y=Math.floor(i/grid.w),result=neighbors(i,grid.w,grid.h);
  for(const [dx,dy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
    const nx=x+dx,ny=y+dy;
    if(nx>=0&&ny>=0&&nx<grid.w&&ny<grid.h)result.push(ny*grid.w+nx);
  }
  return result;
}
export function routeCells(grid,start,goal,{river=false,avoidRoads=false}={}) {
  const {w,h,water,occupied,roads,elevations}=grid,n=w*h,cost=new Float64Array(n);cost.fill(Infinity);cost[start]=0;
  const previous=new Int32Array(n);previous.fill(-1);const heap=new MinHeap();heap.push([0,start]);
  const heuristic=i=>Math.hypot(i%w-goal%w,Math.floor(i/w)-Math.floor(goal/w))*.45;
  let visited=0;
  while(heap.items.length&&visited++<n*5) {
    const [priority,i]=heap.pop();if(priority>cost[i]+heuristic(i)+1e-6&&i!==start)continue;
    if(i===goal) {
      const path=[];let at=goal;while(at!==-1){path.push(at);if(at===start)return path.reverse();at=previous[at];}return [];
    }
    for(const next of nearCells(i,grid)) {
      if(water[next]||occupied[next]||avoidRoads&&roads[next])continue;
      const dx=next%w-i%w,dy=Math.floor(next/w)-Math.floor(i/w);
      // A diagonal cannot cut the corner of a wet or occupied cell.
      if(dx&&dy&&[i+dx,i+dy*w].some(j=>water[j]||occupied[j]||avoidRoads&&roads[j]))continue;
      const distance=dx&&dy?Math.SQRT2:1,slope=elevations[next]-elevations[i];
      const penalty=river?Math.max(0,slope)*35:Math.abs(slope)*18+elevations[next]*.4;
      const step=distance*(roads[next]&&!river?.5:1)+penalty;
      if(cost[i]+step>=cost[next])continue;
      cost[next]=cost[i]+step;previous[next]=i;heap.push([cost[next]+heuristic(next),next]);
    }
  }
  return [];
}
export function thinPoints(points) {
  return points.filter((p,i)=>{
    if(!i||i===points.length-1)return true;
    const a=points[i-1],b=points[i+1];return Math.abs((p[0]-a[0])*(b[1]-p[1])-(p[1]-a[1])*(b[0]-p[0]))>1e-5;
  });
}
export function routeClear(points,width,space) {
  for(let i=1;i<points.length;i++) {
    const a=points[i-1],b=points[i],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/Math.max(1,width*.4)));
    for(let j=0;j<=steps;j++) {
      const x=a[0]+(b[0]-a[0])*j/steps,y=a[1]+(b[1]-a[1])*j/steps;
      if(!space.free([x-width/2,y-width/2,width,width]))return false;
    }
  }return true;
}
export function blockers(map,{roads=false,terrain=false}={}) {
  return decorationSpace({...map,locations:map.locations.filter(p=>p.category==='water'||p.worldStyle?.kind==='building'||roads&&p.category==='street'||terrain&&p.category==='terrain').map(p=>terrain&&p.category==='terrain'?{...p,worldStyle:{kind:'building'}}:p)},map.width/4096);
}
export function appendShape(map,group,type,shape,extra={}) {
  const count=map.locations.filter(p=>p.worldStyle?.origin==='generated'&&p.worldStyle.sourceGroup===group).length;
  const at=shape.points[Math.floor(shape.points.length/2)],building=group==='buildings',road=['majorRoads','roads','cityStreets','paths'].includes(group);
  const place={id:`procedural-v1-${group.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}-${count}`,category:building?'home':road?'street':group==='water'?'water':'terrain',type,district:'imported-area',x:at[0],y:at[1],shape,
    worldStyle:{kind:building?'building':road?'road':group==='water'?'river':'terrain',origin:'generated',sourceGroup:group,established:true,...extra}};
  map.locations.push(place);return place;
}
