const LIMIT=85.05112878;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function project(lon,lat) {
  const sin=Math.sin(clamp(lat,-LIMIT,LIMIT)*Math.PI/180);
  return [(lon+180)/360,(1-Math.log((1+sin)/(1-sin))/(2*Math.PI))/2];
}
export function unproject(x,y) {return [x*360-180,Math.atan(Math.sinh(Math.PI*(1-2*y)))*180/Math.PI];}
export function dimensions(format='square',edge=4096) {
  if(!['square','landscape','portrait'].includes(format)||![2048,4096,4800].includes(edge))throw new Error('Choose an available format and resolution.');
  return format==='square'?[edge,edge]:format==='landscape'?[edge,Math.round(edge*2/3)]:[Math.round(edge*2/3),edge];
}
export function frameSize(w,h,format) {
  const ratio=format==='landscape'?1.5:format==='portrait'?2/3:1;
  const width=Math.min(w*.82,h*.78*ratio);return {x:(w-width)/2,y:(h-width/ratio)/2,width,height:width/ratio};
}
export function areaBounds(center,zoom,frame) {
  const size=256*2**zoom,halfX=frame.width/size/2,halfY=frame.height/size/2;
  const [west,south]=unproject(center[0]-halfX,center[1]+halfY),[east,north]=unproject(center[0]+halfX,center[1]-halfY);
  return {west,south,east,north};
}
export function areaInfo(bounds) {
  const {west,south,east,north}=bounds,lat=(south+north)/2;
  const width=(east-west)*111195*Math.cos(lat*Math.PI/180),height=(north-south)*111195;
  return {width,height,km2:width*height/1e6};
}
export function checkArea(b) {
  if(!b||!['west','south','east','north'].every(k=>Number.isFinite(b[k]))||b.west< -180||b.east>180||b.west>=b.east||b.south>=b.north||b.south< -LIMIT||b.north>LIMIT)throw new Error('Keep the selection inside the world map. Move away from the date line or poles.');
  const area=areaInfo(b);
  if(area.km2>36)throw new Error('Zoom in to select an area smaller than 36 km².');
  if(area.width<40||area.height<40)throw new Error('Zoom out slightly to include at least 40 metres on each side.');
  return area;
}
export function imageProjection(b,width,height) {
  const [left,top]=project(b.west,b.north),[right,bottom]=project(b.east,b.south);
  return (lon,lat)=>{const [x,y]=project(lon,lat);return [(x-left)/(right-left)*width,(y-top)/(bottom-top)*height];};
}
export const ringArea=points=>points.reduce((sum,[x,y],i)=>{const [a,b]=points[(i+1)%points.length];return sum+x*b-a*y;},0)/2;
export function clipRing(input,width,height) {
  let pts=input;
  for(const [axis,limit,greater] of [[0,0,true],[0,width,false],[1,0,true],[1,height,false]]) {
    const result=[];if(!pts.length)break;
    const inside=p=>greater?p[axis]>=limit:p[axis]<=limit;
    let a=pts.at(-1);
    for(const b of pts) {
      if(inside(a)!==inside(b)){const t=(limit-a[axis])/(b[axis]-a[axis]);result.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
      if(inside(b))result.push(b);a=b;
    }pts=result;
  }
  pts=pts.map(([x,y])=>[clamp(x,0,width),clamp(y,0,height)]).filter((p,i,a)=>!i||Math.hypot(p[0]-a[i-1][0],p[1]-a[i-1][1])>1e-7);
  return pts.length>=3&&Math.abs(ringArea(pts))>1e-5?pts:[];
}
export function clipLines(points,width,height,pad=0) {
  const paths=[];let path;
  for(let i=1;i<points.length;i++) {
    const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1];let lo=0,hi=1,valid=true;
    for(const [p,q] of [[-dx,a[0]-pad],[dx,width-pad-a[0]],[-dy,a[1]-pad],[dy,height-pad-a[1]]]) {
      if(p===0){if(q<0)valid=false;continue;}
      const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);
    }
    if(!valid||lo>=hi){path=null;continue;}
    const start=[a[0]+lo*dx,a[1]+lo*dy],end=[a[0]+hi*dx,a[1]+hi*dy];
    for(const p of [start,end]){p[0]=clamp(p[0],pad,width-pad);p[1]=clamp(p[1],pad,height-pad);}
    if(!path||Math.hypot(path.at(-1)[0]-start[0],path.at(-1)[1]-start[1])>1e-5){path=[start];paths.push(path);}
    path.push(end);if(hi<1)path=null;
  }return paths;
}
