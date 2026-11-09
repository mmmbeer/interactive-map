const mix=(a,b,t)=>a+(b-a)*t;
const fade=t=>t*t*t*(t*(t*6-15)+10);
const smooth=(a,b,value)=>{const t=Math.max(0,Math.min(1,(value-a)/(b-a)));return t*t*(3-2*t);};
function lattice(seed,x,y) {
  let n=seed^Math.imul(x,374761393)^Math.imul(y,668265263);
  n=Math.imul(n^n>>>13,1274126177);n=Math.imul(n^n>>>16,2246822519);
  return ((n^n>>>15)>>>0)/4294967296;
}
export function valueNoise(seed,x,y) {
  const ix=Math.floor(x),iy=Math.floor(y),u=fade(x-ix),v=fade(y-iy);
  return mix(mix(lattice(seed,ix,iy),lattice(seed,ix+1,iy),u),mix(lattice(seed,ix,iy+1),lattice(seed,ix+1,iy+1),u),v);
}
// One continuous map-space field crosses parcel seams. Warping removes obvious
// lattice directions; several scales create groves, openings and small thickets.
export function terrainNoise(seed,unit=1) {
  let key=2166136261;for(const c of String(seed)){key^=c.charCodeAt(0);key=Math.imul(key,16777619);}
  const noise=(x,y,salt=0)=>valueNoise(key^salt,x,y);
  return (px,py)=>{
    const x=px/unit,y=py/unit;
    const wx=x+(noise(x/570+13.2,y/570-7.1,101)-.5)*420;
    const wy=y+(noise(x/570-28.4,y/570+19.8,203)-.5)*420;
    const broad=noise(wx/480,wy/480,307),medium=noise(wx/175+33.7,wy/175-12.6,401);
    const fine=noise(wx/58-18.5,wy/58+24.3,503);
    return {coverage:smooth(.31,.69,broad*.62+medium*.28+fine*.1),scale:.8+fine*.4};
  };
}
export function scatterProbability(biome,coverage) {
  if(biome==='orchard')return .55+coverage*.4;
  if(biome==='burial')return .32+coverage*.65;
  // Truly empty pockets remain empty even when the density control is raised.
  // Raising density adds attempts in the same groves instead of filling glades.
  if(coverage<.045)return 0;
  const power=biome==='forest'||biome==='scrub'?2.5:1.9;
  return .012+Math.pow(coverage,power)*(biome==='meadow'?.72:.95);
}
