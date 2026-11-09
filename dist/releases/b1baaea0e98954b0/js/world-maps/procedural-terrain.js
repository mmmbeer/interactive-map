import { components } from '../local-maps/raster.js';
import { gridBoundaries } from './settlement-districts.js';
import { neighbors } from './settlement-grid.js';
import { contains } from '../geometry.js';
import { layoutUnit, layerRandom, planningSpace, routeCells, thinPoints, blockers, routeClear, appendShape } from './procedural-space.js';
function addRiver(map,warnings) {
  const grid=planningSpace(map),random=layerRandom(map,'water'),space=blockers(map,{roads:true}),unit=layoutUnit(map);
  if(!grid.areas.length)return;
  const region=grid.areas[0],cells=[];
  for(let i=0;i<grid.labels.length;i++)if(grid.labels[i]===region.id&&!grid.roads[i])cells.push(i);
  const sinks=cells.filter(i=>{
    const x=i%grid.w,y=Math.floor(i/grid.w);
    return x===1||y===1||x===grid.w-2||y===grid.h-2||neighbors(i,grid.w,grid.h).some(j=>grid.water[j]);
  });
  const starts=[...cells].sort((a,b)=>grid.elevations[b]-grid.elevations[a]).slice(0,Math.max(1,Math.floor(cells.length*.2)));
  for(let attempt=0;attempt<18&&sinks.length&&starts.length;attempt++) {
    const start=starts[Math.floor(random()*starts.length)],near=sinks.filter(i=>Math.hypot(i%grid.w-start%grid.w,Math.floor(i/grid.w)-Math.floor(start/grid.w))>grid.w*.25);
    if(!near.length)continue;
    const goal=near[Math.floor(random()*near.length)],cells=routeCells(grid,start,goal,{river:true,avoidRoads:true});
    if(cells.length<grid.w*.15)continue;
    const points=thinPoints(cells.map(grid.point)),width=unit*14;
    if(!routeClear(points,width,space))continue;
    // Drain into the ocean where an actual shore is present. Never invent a new coast.
    const wet=neighbors(goal,grid.w,grid.h).find(i=>grid.water[i]);
    if(wet!==undefined)points.push(grid.point(wet));
    appendShape(map,'water','river',{kind:'polyline',width,points},{flow:'highland-to-boundary'});return;
  }
  warnings.push('A generated river could not fit without crossing retained buildings or roads. Inland water was left out.');
}
function addTerrain(map,group) {
  const grid=planningSpace(map),mask=new Uint8Array(grid.w*grid.h),space=blockers(map,{roads:true}),unit=layoutUnit(map);
  for(let i=0;i<mask.length;i++) {
    if(grid.water[i]||grid.occupied[i]||grid.roads[i]||grid.terrain[i])continue;
    const [x,y]=grid.point(i),edge=Math.min(x/map.width,1-x/map.width,y/map.height,1-y/map.height);
    const threshold=group==='woodland'?.67:.49;
    if(grid.elevations[i]>threshold&&edge<(group==='woodland'?.36:.12))mask[i]=1;
  }
  const {items,labels}=components(mask,grid.w,grid.h,30);
  for(const item of items.sort((a,b)=>b.size-a.size||a.id-b.id).slice(0,group==='woodland'?5:2)) {
    for(const shape of gridBoundaries(labels,grid,item.id)) {
      const point=grid.point(labels.indexOf(item.id));if(!contains({shape},...point)||!space.free([point[0]-unit,point[1]-unit,unit*2,unit*2]))continue;
      const p=appendShape(map,group,group==='woodland'?'forest':'field',shape,{kind:'terrain',landuse:group==='woodland'?'forest':'grass'});p.x=point[0];p.y=point[1];
    }
  }
}
export function generateLandscape(map,needs,warnings) {
  if(needs('water'))addRiver(map,warnings);
  if(needs('woodland'))addTerrain(map,'woodland');
  if(needs('openland'))addTerrain(map,'openland');
}
