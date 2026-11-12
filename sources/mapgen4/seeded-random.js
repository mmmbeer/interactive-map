// Interactive Map adapter, MIT. Independent seeded stream, never Math.random.
export function makeRandFloat(seed) {
  let n=seed>>>0;
  return ()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
}
