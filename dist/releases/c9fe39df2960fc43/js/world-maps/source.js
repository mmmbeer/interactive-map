import { checkArea } from './geo.js';
import { MapRequestError, requestMapData } from './request.js';
let cache,preferred;
const blockedUntil=new Map();
export const OVERPASS='https://overpass.private.coffee/api/interpreter';
export const MAP_SERVICES=[OVERPASS,'https://overpass-api.de/api/interpreter'];
export function queryFor(b) {
  checkArea(b);const box=[b.south,b.west,b.north,b.east].map(n=>n.toFixed(7)).join(',');
  return `[out:json][timeout:12][maxsize:33554432];(way[building](${box});way[highway][highway!~"^(proposed|construction)$"](${box});nwr[natural~"^(water|wood|scrub|wetland|tree|coastline)$"](${box});nwr[waterway](${box});nwr[landuse~"^(forest|grass|meadow|farmland|farmyard|orchard|vineyard|cemetery|recreation_ground)$"](${box});nwr[leisure~"^(park|garden)$"](${box});relation[type=multipolygon][building](${box});nwr[place~"^(neighbourhood|quarter|suburb)$"](${box});relation[boundary=administrative][admin_level~"^(9|10)$"](${box}););out geom;`;
}
export async function fetchArea(bounds,signal,{onProgress=()=>{},services=MAP_SERVICES,timeoutMs=15000,fetcher=globalThis.fetch}={}) {
  signal?.throwIfAborted();
  const query=queryFor(bounds);
  if(cache?.query===query)return cache.data;
  const endpoints=[...services].sort((a,b)=>(a===preferred?-1:0)-(b===preferred?-1:0));
  for(let i=0;i<endpoints.length;i++) {
    const url=endpoints[i];
    // Respect a provider's rate limit. Do not retry it or route around its 429.
    if(Date.now()<(blockedUntil.get(url)||0))throw new Error('The map service is busy. Wait a minute before trying again.');
    onProgress({stage:i?'fallback':'waiting',attempt:i+1,attempts:endpoints.length,bytes:0});
    try {
      const data=await requestMapData(url,query,{signal,timeoutMs,fetcher,onProgress:p=>onProgress({...p,attempt:i+1,attempts:endpoints.length})});
      signal?.throwIfAborted();cache={query,data};preferred=url;return data;
    } catch(e) {
      signal?.throwIfAborted();
      if(e.status===429){blockedUntil.set(url,Date.now()+60000);throw e;}
      if(e instanceof MapRequestError&&!e.retryable)throw e;
      if(i===endpoints.length-1)throw new Error('The map data services are not responding. Try again shortly. Your selection has been kept.');
    }
  }
  throw new Error('No map data service is configured.');
}
