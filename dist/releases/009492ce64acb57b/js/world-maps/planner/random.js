import { seedNumber } from '../procedural-space.js';
export const VERSION=2;
export const compare=(a,b)=>a<b?-1:a>b?1:0;
export function randomFor(map,key) {
  let n=seedNumber(`${map.generationId}:${map.generator.seed}:layout-v2:${key}`);
  return ()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
}
export const stableId=(kind,value)=>{
  const text=JSON.stringify(value);
  return `layout-v2-${kind}-${seedNumber(text).toString(16)}${seedNumber('identity-v2:'+text).toString(16).padStart(8,'0')}`;
};
export const unitFor=map=>Math.max(map.width/4096,.45/map.measurement.metersPerPixel);
export const precisionFor=map=>Math.min(map.width/1e5,.01/map.measurement.metersPerPixel);
export const roundPoint=(p,precision)=>p.map(x=>Math.round(x/precision)*precision);
