export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function project(point,a,b) {
  const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
  const t=length ? Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/length)) : 0;
  const result={x:a.x+t*dx,y:a.y+t*dy,t};return {...result,distance:distance(point,result)};
}
export function crossing(a,b,c,d) {
  const dx=b.x-a.x,dy=b.y-a.y,ex=d.x-c.x,ey=d.y-c.y,den=dx*ey-dy*ex;
  if(Math.abs(den)<1e-10)return null;
  const t=((c.x-a.x)*ey-(c.y-a.y)*ex)/den,u=((c.x-a.x)*dy-(c.y-a.y)*dx)/den;
  if(t< -1e-8 || t>1+1e-8 || u< -1e-8 || u>1+1e-8)return null;
  return {x:a.x+t*dx,y:a.y+t*dy,t:Math.max(0,Math.min(1,t)),u:Math.max(0,Math.min(1,u))};
}
export const pathLength=points=>points.slice(1).reduce((sum,p,i)=>sum+distance(points[i],p),0);
export const units={m:1,km:1000,ft:0.3048,mi:1609.344};
export function calibration(points,value,unit) {
  const pixels=pathLength(points);
  if(points.length!==2 || pixels<1 || !Number.isFinite(value) || value<=0 || !Object.hasOwn(units,unit))throw new Error('Choose two distinct points and enter a positive known distance.');
  return {metersPerPixel:value*units[unit]/pixels,unit};
}
export function formatDistance(pixels,scale,unit=scale?.unit || 'm') {
  if(!scale)return `${Number(pixels.toFixed(1)).toLocaleString()} px`;
  return `${Number((pixels*scale.metersPerPixel/units[unit]).toFixed(2)).toLocaleString()} ${unit}`;
}
export function travelTime(pixels,scale,speed) {
  if(!scale)return '';
  const minutes=pixels*scale.metersPerPixel/(speed*1000)*60;
  if(!Number.isFinite(minutes) || speed<=0)throw new Error('Travel speed must be positive.');
  const rounded=Math.round(minutes);
  return minutes<1 ? 'under 1 minute' : rounded<60 ? `${rounded} minute${rounded===1?'':'s'}` : `${Math.floor(rounded/60)} h ${rounded%60} min`;
}
