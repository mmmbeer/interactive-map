import { components, outline, area } from '../local-maps/raster.js';
import { ringContains } from '../geometry.js';
import { roots } from '../generation/wordbanks-v2.js';
import { settlementProfiles } from '../generation/settlement-pools-v1.js';
import { MinHeap, neighbors } from './settlement-grid.js';
const hash=value=>{let n=2166136261;for(const c of value){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;};
export function gridBoundaries(labels,grid,id) {
  const {w,h,sx,sy}=grid,item={id,left:w,top:h,right:0,bottom:0};let count=0;
  for(let i=0;i<labels.length;i++)if(labels[i]===id){count++;item.left=Math.min(item.left,i%w);item.right=Math.max(item.right,i%w);item.top=Math.min(item.top,Math.floor(i/w));item.bottom=Math.max(item.bottom,Math.floor(i/w));}
  if(!count)return [];
  const rings=outline(labels,w,h,item,sx,sy),outer=rings.filter(r=>area(r)>0),holes=rings.filter(r=>area(r)<0);
  return outer.map(points=>({kind:'polygon',points,...(holes.some(r=>r.every(([x,y])=>ringContains(points,x,y)))?{holes:holes.filter(r=>r.every(([x,y])=>ringContains(points,x,y)))}:{})}));
}
export function planDistricts(map,grid,profile,mapped=[]) {
  const {w,h,water,roads,cell,point}=grid,land=water.map(v=>v?0:1),regions=components(land,w,h),labels=new Int32Array(w*h);
  const buildings=map.locations.filter(p=>!['water','street','terrain'].includes(p.category)).sort((a,b)=>a.id.localeCompare(b.id));
  const requested=profile.districtMode==='single'?1:profile.districtCount||Math.min(8,Math.max(1,Math.ceil(buildings.length/65)));
  const seeds=[],used=new Set(),districts=[],warnings=[];
  const candidates=buildings.map(p=>cell(p.x,p.y)).filter(i=>!water[i]);
  // Each inhabited land component needs a seed. Water never becomes a district bridge.
  for(const i of candidates)if(!used.has(regions.labels[i])){used.add(regions.labels[i]);seeds.push(i);}
  if(!seeds.length&&regions.items.length)seeds.push(regions.labels.indexOf(regions.items.sort((a,b)=>b.size-a.size)[0].id));
  const sourceDistricts=profile.districtMode==='mapped'?mapped:[];
  if(profile.districtMode==='mapped'&&!sourceDistricts.length)warnings.push('Mapped district boundaries were unavailable. Suggested districts follow roads and water.');
  const goal=Math.min(12,requested);
  while(seeds.length<goal&&candidates.length) {
    let best=-1,distance=-1;
    for(const i of candidates) {
      if(seeds.includes(i))continue;
      const d=Math.min(...seeds.map(s=>((i%w)-(s%w))**2+(Math.floor(i/w)-Math.floor(s/w))**2));
      if(d>distance){distance=d;best=i;}
    }
    if(best<0)break;seeds.push(best);
  }
  // Imported neighborhood outlines are rasterized into nonoverlapping zones first.
  if(sourceDistricts.length) {
    for(const [i,d] of sourceDistricts.slice(0,12).entries())for(const shape of d.boundaries)grid.polygon(shape,labels,i+1);
    for(let i=0;i<labels.length;i++)if(water[i])labels[i]=0;
    seeds.length=0;
    for(let id=1;id<=Math.min(12,sourceDistricts.length);id++){const i=labels.indexOf(id);if(i>=0)seeds.push(i);}
  }
  if(!seeds.length){map.districts=[{id:'imported-area',name:'Imported area'}];return {warnings};}
  const distances=new Float64Array(w*h);distances.fill(Infinity);const heap=new MinHeap();
  if(sourceDistricts.length) {
    for(let i=0;i<labels.length;i++)if(labels[i]){distances[i]=0;heap.push([0,i,labels[i]]);}
  } else seeds.forEach((i,j)=>{const id=j%goal+1;labels[i]=id;distances[i]=0;heap.push([0,i,id]);});
  while(heap.items.length) {
    const [cost,i,id]=heap.pop();if(cost!==distances[i])continue;
    for(const next of neighbors(i,w,h)) {
      if(water[next])continue;
      const d=cost+1+(roads[next]?22:0);
      if(d<distances[next]){distances[next]=d;labels[next]=id;heap.push([d,next,id]);}
    }
  }
  // Uninhabited disconnected pieces belong to their nearest mapped neighborhood.
  for(let i=0;i<labels.length;i++)if(!water[i]&&!labels[i]) {
    let best=0,distance=Infinity;
    seeds.forEach((s,j)=>{const d=((i%w)-(s%w))**2+(Math.floor(i/w)-Math.floor(s/w))**2;if(d<distance){best=j;distance=d;}});labels[i]=labels[seeds[best]];
  }
  const palette=settlementProfiles[profile.ancestry]?.roots||roots;
  const ids=[...new Set(labels)].filter(Boolean).sort((a,b)=>a-b);
  for(const id of ids) {
    const boundaries=gridBoundaries(labels,grid,id);if(!boundaries.length)continue;
    let cx=0,cy=0,count=0;
    for(let i=0;i<labels.length;i++)if(labels[i]===id){cx+=i%w;cy+=Math.floor(i/w);count++;}
    cx/=count;cy/=count;let anchor=labels.indexOf(id),best=Infinity;
    for(let i=0;i<labels.length;i++)if(labels[i]===id) {
      const d=(i%w-cx)**2+(Math.floor(i/w)-cy)**2+(roads[i]||grid.occupied[i]?w*h:0);
      if(d<best){best=d;anchor=i;}
    }
    const [x,y]=point(anchor);
    let name=sourceDistricts[id-1]?.name||`${palette[hash(`${map.generator.seed}:district:${id}`)%palette.length]} ${profile.type==='farming_village'?'Crofts':'Quarter'}`;
    if(districts.some(d=>d.name===name))name+=` ${id}`;
    districts.push({id:`district-${id}`,name,label:{x,y},boundaries});
  }
  if(districts.length)map.districts=districts;
  for(const p of map.locations) {
    const i=cell(p.x,p.y);let id=labels[i];
    if(!id){let best=Infinity;for(const s of seeds){const d=((i%w)-(s%w))**2+(Math.floor(i/w)-Math.floor(s/w))**2;if(d<best){best=d;id=labels[s];}}}
    p.district=`district-${id}`;
  }
  return {warnings,labels};
}
