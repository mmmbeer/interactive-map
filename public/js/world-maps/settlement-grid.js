import { boundsFor } from '../geometry.js';
// A small planning grid proposes land uses and district boundaries. It never moves
// source roads, water, buildings or existing land-use polygons.
export function settlementGrid(map,edge=192) {
  const scale=edge/Math.max(map.width,map.height),w=Math.max(8,Math.round(map.width*scale)),h=Math.max(8,Math.round(map.height*scale)),sx=map.width/w,sy=map.height/h;
  const water=new Uint8Array(w*h),roads=new Uint8Array(w*h),occupied=new Uint8Array(w*h),terrain=new Uint8Array(w*h);
  const cell=(x,y)=>Math.max(0,Math.min(h-1,Math.floor(y/sy)))*w+Math.max(0,Math.min(w-1,Math.floor(x/sx)));
  function polygon(shape,mask,value=1) {
    const rings=[shape.points,...(shape.holes||[])],ys=shape.points.map(p=>p[1]);
    for(let y=Math.max(0,Math.floor(Math.min(...ys)/sy));y<=Math.min(h-1,Math.floor(Math.max(...ys)/sy));y++) {
      const py=(y+.5)*sy,crossings=[];
      for(const ring of rings)for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
        const a=ring[j],b=ring[i];if((a[1]>py)!==(b[1]>py))crossings.push(a[0]+(py-a[1])*(b[0]-a[0])/(b[1]-a[1]));
      }
      crossings.sort((a,b)=>a-b);
      for(let i=0;i+1<crossings.length;i+=2) {
        const left=Math.max(0,Math.ceil(crossings[i]/sx-.5)),right=Math.min(w-1,Math.floor(crossings[i+1]/sx-.5));
        for(let x=left;x<=right;x++)mask[y*w+x]=value;
      }
    }
  }
  function route(shape,mask) {
    const pad=Math.max(shape.width/2,Math.min(sx,sy)*.6);
    for(let i=1;i<shape.points.length;i++) {
      const a=shape.points[i-1],b=shape.points[i],dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
      const left=Math.max(0,Math.floor((Math.min(a[0],b[0])-pad)/sx)),right=Math.min(w-1,Math.floor((Math.max(a[0],b[0])+pad)/sx));
      const top=Math.max(0,Math.floor((Math.min(a[1],b[1])-pad)/sy)),bottom=Math.min(h-1,Math.floor((Math.max(a[1],b[1])+pad)/sy));
      for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++) {
        const px=(x+.5)*sx,py=(y+.5)*sy,t=den?Math.max(0,Math.min(1,((px-a[0])*dx+(py-a[1])*dy)/den)):0;
        if(Math.hypot(px-a[0]-t*dx,py-a[1]-t*dy)<=pad)mask[y*w+x]=1;
      }
    }
  }
  for(const p of map.locations) {
    if(p.category==='water') {if(p.shape.kind==='polygon')polygon(p.shape,water);else if(p.shape.kind==='polyline')route(p.shape,water);}
    else if(p.category==='street'&&p.shape?.kind==='polyline')route(p.shape,roads);
    else if(p.category==='terrain'&&p.shape?.kind==='polygon')polygon(p.shape,terrain);
    else if(p.shape?.kind==='polygon') {
      const [x,y,bw,bh]=boundsFor(p),pad=Math.max(sx,sy)*1.5;
      for(let cy=Math.max(0,Math.floor((y-pad)/sy));cy<=Math.min(h-1,Math.floor((y+bh+pad)/sy));cy++)for(let cx=Math.max(0,Math.floor((x-pad)/sx));cx<=Math.min(w-1,Math.floor((x+bw+pad)/sx));cx++)occupied[cy*w+cx]=1;
    }
  }
  return {w,h,sx,sy,cell,water,roads,occupied,terrain,polygon,point:i=>[(i%w+.5)*sx,(Math.floor(i/w)+.5)*sy]};
}
export class MinHeap {
  constructor(){this.items=[];}
  push(item){const a=this.items;a.push(item);let i=a.length-1;while(i){const parent=(i-1)>>1;if(a[parent][0]<=item[0])break;a[i]=a[parent];i=parent;}a[i]=item;}
  pop(){const a=this.items,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&a[j+1][0]<a[j][0])j++;if(a[j][0]>=last[0])break;a[i]=a[j];i=j;}a[i]=last;}return first;}
}
export function neighbors(i,w,h) {const x=i%w,y=Math.floor(i/w);return [x?i-1:-1,x<w-1?i+1:-1,y?i-w:-1,y<h-1?i+w:-1].filter(p=>p>=0);}
