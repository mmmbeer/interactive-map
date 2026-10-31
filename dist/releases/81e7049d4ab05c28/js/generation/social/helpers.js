// Fast stable ranks for bounded matching. Geometry and array order never enter a seed.
export function hash(text) {
  let h=2166136261;for(const c of String(text)){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return h>>>0;
}
export function pairRank(a,b,seed=0) {
  let h=(a^Math.imul(b,0x9e3779b1)^seed)>>>0;h=Math.imul(h^(h>>>16),0x85ebca6b);h=Math.imul(h^(h>>>13),0xc2b2ae35);return (h^(h>>>16))>>>0;
}
export const compare=(a,b)=>a<b?-1:a>b?1:0;
export const adult=age=>!['child','infant','adolescent'].includes(age);
export function permits(config,demographics) {
  return ['race','culture','gender','age'].every(one=>{
    const many={race:'races',culture:'cultures',gender:'genders',age:'ages'}[one];
    return config.demographics[one]!==undefined ? config.demographics[one]===demographics[one] : (config.demographics[many]?.[demographics[one]] || 0)>0;
  });
}
export function addTo(index,key,value) {if(!index.has(key))index.set(key,[]);index.get(key).push(value);}
