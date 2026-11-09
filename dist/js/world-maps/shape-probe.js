import { boundsFor, contains, distanceToPath } from '../geometry.js';
export function crosses(a,b,box) {
  let lo=0,hi=1;
  for(let axis=0;axis<2;axis++) {
    const delta=b[axis]-a[axis],min=box[axis],max=min+box[axis+2];
    if(!delta){if(a[axis]<min||a[axis]>max)return false;continue;}
    const t=(min-a[axis])/delta,u=(max-a[axis])/delta;
    lo=Math.max(lo,Math.min(t,u));hi=Math.min(hi,Math.max(t,u));if(lo>hi)return false;
  }return true;
}
const corners=([x,y,w,h])=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const overlap=(a,b)=>a[0]<=b[0]+b[2]&&a[0]+a[2]>=b[0]&&a[1]<=b[1]+b[3]&&a[1]+a[3]>=b[1];
// Cache bounds and bucket edges by row. A complicated coast must not rescan
// every vertex for each roof, tree or road sample. Geometry stays exact.
export function shapeProbe(place) {
  const box=boundsFor(place),shape=place.shape,rows=Array.from({length:64},()=>[]),edges=[];
  const row=y=>Math.max(0,Math.min(63,Math.floor((y-box[1])/Math.max(1e-9,box[3])*64)));
  if(['polygon','polyline'].includes(shape?.kind)) {
    for(const [ringIndex,points] of [shape.points,...(shape.holes||[])].entries())for(let i=0;i<points.length-(shape.kind==='polyline'?1:0);i++) {
      const a=points[i],b=points[(i+1)%points.length],edge={a,b,ringIndex};edges.push(edge);
      for(let r=row(Math.min(a[1],b[1]));r<=row(Math.max(a[1],b[1]));r++)rows[r].push(edge);
    }
  }
  function inside(x,y) {
    if(x<box[0]||x>box[0]+box[2]||y<box[1]||y>box[1]+box[3])return false;
    if(shape?.kind!=='polygon')return contains(place,x,y);
    const flags=new Uint8Array(1+(shape.holes?.length||0)),boundary=new Uint8Array(flags.length);
    for(const {a,b,ringIndex:r} of rows[row(y)]) {
      const cross=(x-a[0])*(b[1]-a[1])-(y-a[1])*(b[0]-a[0]);
      if(Math.abs(cross)<1e-8&&x>=Math.min(a[0],b[0])&&x<=Math.max(a[0],b[0])&&y>=Math.min(a[1],b[1])&&y<=Math.max(a[1],b[1]))boundary[r]=1;
      if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])flags[r]^=1;
    }
    return Boolean(flags[0]||boundary[0])&&!flags.some((v,i)=>i&&(v||boundary[i]));
  }
  function candidates(b) {
    const result=new Set();for(let r=row(b[1]);r<=row(b[1]+b[3]);r++)for(const e of rows[r])result.add(e);return result;
  }
  const boundaryCrosses=b=>[...candidates(b)].some(e=>crosses(e.a,e.b,b));
  return {box,inside,
    intersects(b) {
      if(!overlap(box,b))return false;
      if(shape?.kind==='polyline') {const r=shape.width/2,expanded=[b[0]-r,b[1]-r,b[2]+r*2,b[3]+r*2];return boundaryCrosses(expanded);}
      if(shape?.kind!=='polygon')return true;
      return corners(b).some(([x,y])=>inside(x,y))||boundaryCrosses(b);
    },
    fits(b) {
      const vertices=corners(b);if(!vertices.every(([x,y])=>inside(x,y)))return false;
      if(shape?.kind==='polyline')return edges.some(e=>vertices.every(([x,y])=>distanceToPath([e.a,e.b],x,y)<=shape.width/2));
      return shape?.kind!=='polygon'||!boundaryCrosses(b);
    }
  };
}
