export const MAX_MAP_EDGE=8192,MAX_MAP_PIXELS=24000000,MAX_MAP_LOCATIONS=30000;
export function validateMapLimits(map) {
  const fail=message=>{throw new Error(message);};
  if(!Number.isSafeInteger(map.width)||!Number.isSafeInteger(map.height)||map.width<1||map.height<1||
    map.width>MAX_MAP_EDGE||map.height>MAX_MAP_EDGE||map.width*map.height>MAX_MAP_PIXELS) {
    fail('Map dimensions must be whole pixels, at most 8192 per side and 24 million pixels total.');
  }
  if(!Array.isArray(map.locations)||!map.locations.length||map.locations.length>MAX_MAP_LOCATIONS)fail('A map needs 1 to 30000 locations.');
  // Bound nested catalogs and geometry before validators, generators or indexes run.
  let nodes=0,characters=0;const seen=new WeakSet(),pending=[[map,0]];
  while(pending.length) {
    const [value,depth]=pending.pop();
    if(++nodes>1500000||depth>32)fail('The map contains too much nested data.');
    if(typeof value==='string') {
      characters+=value.length;
      if(characters>12000000||value.length>100000)fail('The map contains too much text.');
    } else if(value&&typeof value==='object') {
      if(seen.has(value))continue;seen.add(value);
      const entries=Object.entries(value);
      if(entries.length>100000||pending.length+entries.length>1500000)fail('The map contains too many data entries.');
      for(const [,child] of entries)pending.push([child,depth+1]);
    }
  }
  let points=0,holeChecks=0;
  const ring=value=>{
    if(!Array.isArray(value))return;
    points+=value.length;
    if(value.length>8192||points>250000)fail('The map geometry is too complex. Simplify its outlines.');
  };
  for(const place of map.locations) {
    ring(place?.shape?.points);
    for(const hole of place?.shape?.holes||[]) {
      ring(hole);holeChecks+=(place.shape.points?.length||0)*(hole?.length||0);
      if(holeChecks>16000000)fail('The map geometry is too complex. Simplify its polygon holes.');
    }
  }
  for(const district of [...(map.districts||[]),...(map.districtAreas||[])])for(const shape of district?.boundaries||[])ring(shape.points);
}
export function relativeAssetPath(value) {
  if(typeof value!=='string'||!value||/[\s\u0000-\u001f\u007f\\:?#%]/.test(value)||value.startsWith('/')||value.split('/').includes('..'))return false;
  try {return new URL(value,'https://atlas.invalid/').origin==='https://atlas.invalid';}catch{return false;}
}
