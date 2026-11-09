import { distanceToPath } from '../geometry.js';
import { layoutUnit, layerRandom, planningSpace, routeCells, thinPoints, blockers, routeClear, appendShape, nearCells } from './procedural-space.js';
const routeCounts={hamlet:6,village:12,farming_village:14,town:24,city:45,metropolis:65,port:38,mining_outpost:8,forest_hold:18,fortress:18,monastery:10,academy:20,caravan_stop:8,undercity:26};
export function generateStreets(map,needs,profile,warnings) {
  const unit=layoutUnit(map);
  for(const [group,count,width] of [['majorRoads',3,19],['roads',7,12],['cityStreets',routeCounts[profile.type],8],['paths',Math.ceil(routeCounts[profile.type]*.65),4]]) {
    if(!needs(group))continue;
    const grid=planningSpace(map),random=layerRandom(map,group),space=blockers(map),roads=map.locations.filter(p=>p.category==='street');
    const originalWater=grid.water;grid.water=originalWater.map((v,i)=>v||nearCells(i,grid).some(j=>originalWater[j])?1:0);
    const roadPoints=roads.flatMap(p=>p.shape.points.map(([x,y])=>grid.cell(x,y))).filter(i=>!grid.water[i]&&!grid.occupied[i]);
    const before=map.locations.length;
    for(const area of grid.areas.filter(a=>a.size>grid.w*grid.h*.015)) {
      const cells=[];for(let i=0;i<grid.labels.length;i++)if(grid.labels[i]===area.id&&!grid.water[i])cells.push(i);
      if(!cells.length)continue;
      const center=[cells.reduce((n,i)=>n+i%grid.w,0)/cells.length,cells.reduce((n,i)=>n+Math.floor(i/grid.w),0)/cells.length];
      const clear=i=>{const [x,y]=grid.point(i),r=width*unit*.65;return space.free([x-r,y-r,r*2,r*2]);};
      const score=i=>Math.hypot(i%grid.w-center[0],Math.floor(i/grid.w)-center[1]);
      const hub=[...cells].sort((a,b)=>score(a)-score(b)||a-b).find(clear);if(hub===undefined)continue;
      const anchors=roadPoints.filter(i=>grid.labels[i]===area.id);if(!anchors.length)anchors.push(hub);
      let placed=0;const target=Math.max(1,Math.round(count*Math.min(1,map.width*map.measurement.metersPerPixel/1400)*area.size/grid.areas.reduce((n,a)=>n+a.size,0)));
      for(let attempt=0;attempt<target*14&&placed<target;attempt++) {
        const start=cells[Math.floor(random()*cells.length)];if(!clear(start))continue;
        const goal=anchors.reduce((best,i)=>Math.hypot(i%grid.w-start%grid.w,Math.floor(i/grid.w)-Math.floor(start/grid.w))<Math.hypot(best%grid.w-start%grid.w,Math.floor(best/grid.w)-Math.floor(start/grid.w))?i:best,anchors[0]);
        if(Math.hypot(start%grid.w-goal%grid.w,Math.floor(start/grid.w)-Math.floor(goal/grid.w))<(group==='paths'?2:4))continue;
        const path=routeCells(grid,start,goal);if(path.length<3)continue;
        // Keep only new branches. Existing routes supply the connection rather
        // than receiving a second line drawn over their geometry.
        let end=path.findIndex((i,j)=>j>0&&grid.roads[i]);if(end<0)end=path.length-1;
        const points=thinPoints(path.slice(0,end+1).map(grid.point));if(points.length<2||!routeClear(points,width*unit,space))continue;
        const existing=map.locations.filter(p=>p.category==='street');
        if(points.every(([x,y])=>existing.some(p=>distanceToPath(p.shape.points,x,y)<(p.shape.width+width*unit)/2)))continue;
        // Make the final junction exact when the planning cell is near a route.
        const last=points.at(-1);let nearest,dist=Infinity;
        for(const p of existing)for(let i=1;i<p.shape.points.length;i++) {
          const a=p.shape.points[i-1],b=p.shape.points[i],dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
          const t=den?Math.max(0,Math.min(1,((last[0]-a[0])*dx+(last[1]-a[1])*dy)/den)):0,q=[a[0]+t*dx,a[1]+t*dy],d=Math.hypot(q[0]-last[0],q[1]-last[1]);
          if(d<dist){nearest=q;dist=d;}
        }
        if(nearest&&dist<Math.max(grid.sx,grid.sy)*2&&routeClear([last,nearest],width*unit,space))points.push(nearest);
        appendShape(map,group,group==='paths'?'trail':'street',{kind:'polyline',width:width*unit,points},{kind:'road'});
        for(const i of path.slice(0,end+1)){grid.roads[i]=1;anchors.push(i);}placed++;
      }
    }
    if(map.locations.length===before)warnings.push(`No new ${group==='majorRoads'?'main routes':group==='cityStreets'?'city streets':group==='paths'?'alleys or footpaths':'roads'} fit around the retained geography. Existing routes remain usable.`);
  }
}
