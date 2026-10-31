import { components, outline, skeleton, paths } from './raster.js';
import { ringContains, distanceToPath } from '../geometry.js';
import { validateMap } from '../map-contract.js';

export function classify(rgba,w,h,{palette={},tolerance=55,darkness=110}={}) {
  const masks=Object.fromEntries(['building','road','water','terrain'].map(k=>[k,new Uint8Array(w*h)]));
  for(let i=0;i<w*h;i++) {
    const [r,g,b,a]=rgba.subarray(i*4,i*4+4);if(a<128)continue;
    const lo=Math.min(r,g,b),hi=Math.max(r,g,b),light=(r+g+b)/3;
    let kind='';
    for(const key of ['water','terrain','building','road']) {
      const color=palette[key];
      if(color && Math.hypot(r-color[0],g-color[1],b-color[2])<tolerance){kind=key;break;}
    }
    if(!kind) {
      if(!palette.water && b>r*1.08 && g>r*1.02 && b-r>18)kind='water';
      else if(!palette.terrain && g>r*1.07 && g>b*1.08 && hi-lo>20)kind='terrain';
      else if(!palette.building && (light<darkness || r>g*1.25 && r>b*1.3 && r>100 && g<170))kind='building';
      else if(!palette.road && lo>165 && hi-lo<65)kind='road';
    }
    if(kind)masks[kind][i]=1;
  }
  return masks;
}
function narrowRoads(mask,w,h) {
  const distance=new Uint16Array(mask.length);distance.fill(10000);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
    const p=y*w+x;
    distance[p]=!mask[p]?0:Math.min(x?distance[p-1]+1:1,y?distance[p-w]+1:1);
  }
  for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--) {
    const p=y*w+x;distance[p]=Math.min(distance[p],x<w-1?distance[p+1]+1:1,y<h-1?distance[p+w]+1:1);
  }
  // Broad blank paper and fields are not road corridors.
  const thin=skeleton(mask,w,h);
  for(let p=0;p<thin.length;p++)if(distance[p]>14 || p%w<2 || p%w>w-3 || p<w*2 || p>=w*(h-2))thin[p]=0;
  return {thin,distance};
}
export function recognizeMap({rgba,w,h,width,height,id,name,seed,options={}},progress=()=>{}) {
  const sx=width/w,sy=height/h,locations=[];
  const map={schemaVersion:2,id,name,subtitle:'Your locally saved map',description:'A user map with editable image-recognition candidates.',
    image:`local/${id}/map`,thumbnail:`local/${id}/thumbnail`,width,height,theme:'Local map',region:'Your atlas',directoryScope:'all',
    generator:{version:2,detailsVersion:2,seed:seed||id,defaults:{demographics:{race:'human'}}},districts:[],locations};
  progress('Finding water, terrain and buildings…');
  const masks=classify(rgba,w,h,options),land=new Uint8Array(w*h);
  const add=(category,item,labels)=>{
    const rings=outline(labels,w,h,item,sx,sy);if(!rings.length)return;
    const points=rings[0];
    // Only contained rings are holes. A component can touch itself at a corner.
    const holes=rings.slice(1).filter(r=>r.every(([x,y])=>ringContains(points,x,y)));
    locations.push({id:`${category}-${item.id}`,category,type:category==='water'?'lake':category==='terrain'?'forest':'home',district:'unassigned',
      x:(item.x+0.5)*sx,y:(item.y+0.5)*sy,shape:{kind:'polygon',points,...(holes.length?{holes}:{})}});
  };
  for(const category of ['water','terrain','building']) {
    const {labels,items}=components(masks[category],w,h,category==='building'?6:45);
    for(const item of items) {
      const bw=item.right-item.left+1,bh=item.bottom-item.top+1;
      // Buildings must be compact structures, not connected walls or text lines.
      if(category==='building' && (item.size>w*h*0.005 || bw/bh>7 || bh/bw>7 || item.size/(bw*bh)<0.15))continue;
      add(category==='building'?'home':category,item,labels);
    }
  }
  progress('Tracing road centerlines…');
  const {thin,distance}=narrowRoads(masks.road,w,h),routes=paths(thin,w,h);
  for(let i=0;i<routes.length;i++) {
    const route=routes[i];
    const length=route.slice(1).reduce((sum,p,j)=>sum+Math.hypot(p[0]-route[j][0],p[1]-route[j][1]),0);
    if(length<12)continue;
    const mid=route[Math.floor(route.length/2)],radius=Math.max(1,distance[Math.floor(mid[1])*w+Math.floor(mid[0])]||1);
    const widthPx=Math.max(1,Math.min(sx,sy)*radius*1.5),pad=widthPx/2+0.001;
    const points=route.map(([x,y])=>[Math.max(pad,Math.min(width-pad,x*sx)),Math.max(pad,Math.min(height-pad,y*sy))]);
    locations.push({id:`street-${i+1}`,category:'street',type:'street',district:'unassigned',x:points[0][0],y:points[0][1],shape:{kind:'polyline',width:widthPx,points}});
  }
  progress('Finding district boundaries and linking places…');
  // Roads and water separate candidate neighborhoods. These are suggestions, not jurisdictions.
  for(let i=0;i<land.length;i++)land[i]=!masks.water[i] && !masks.road[i]?1:0;
  const districts=components(land,w,h,Math.max(100,w*h*0.002));
  for(const item of districts.items) {
    const rings=outline(districts.labels,w,h,item,sx,sy);if(!rings.length)continue;
    const points=rings[0],holes=rings.slice(1).filter(r=>r.every(([x,y])=>ringContains(points,x,y)));
    map.districts.push({id:`district-${item.id}`,name:`Neighborhood ${map.districts.length+1}`,boundaries:[{kind:'polygon',points,...(holes.length?{holes}:{})}]});
  }
  map.districts.push({id:'unassigned',name:'Unassigned area'});
  const roads=locations.filter(p=>p.category==='street');
  for(const p of locations) {
    const cell=Math.min(h-1,Math.floor(p.y/sy))*w+Math.min(w-1,Math.floor(p.x/sx));
    const district=`district-${districts.labels[cell]}`;
    if(map.districts.some(d=>d.id===district))p.district=district;
    if(p.category==='home') {
      let best=null,distance=Infinity;
      for(const road of roads) {
        const d=distanceToPath(road.shape.points,p.x,p.y);
        if(d<distance){distance=d;best=road;}
      }
      if(best && distance<Math.max(sx,sy)*80)p.context={street:best.id};
    }
  }
  if(!locations.length)throw new Error('No features found. Adjust the recognition colors or thresholds and process again. You can also attach annotated map JSON.');
  if(locations.length>12000)throw new Error('Too many candidates. Lower the building threshold or use a higher color tolerance and process again.');
  map.recognition={version:1,analysisWidth:w,analysisHeight:h,options,reviewRequired:true};
  validateMap(map);return map;
}
