import { checkArea } from './geo.js';
let cache,blockedUntil=0;
export const OVERPASS='https://overpass.private.coffee/api/interpreter';
export function queryFor(b) {
  checkArea(b);const box=[b.south,b.west,b.north,b.east].map(n=>n.toFixed(7)).join(',');
  return `[out:json][timeout:50][maxsize:33554432];(way[building](${box});way[highway][highway!~"^(proposed|construction)$"](${box});nwr[natural~"^(water|wood|scrub|wetland|tree|coastline)$"](${box});nwr[waterway](${box});nwr[landuse~"^(forest|grass|meadow|farmland|farmyard|orchard|vineyard|cemetery|recreation_ground)$"](${box});nwr[leisure~"^(park|garden)$"](${box});relation[type=multipolygon][building](${box}););out geom;`;
}
export async function fetchArea(bounds,signal) {
  const query=queryFor(bounds);
  if(cache?.query===query)return cache.data;
  if(Date.now()<blockedUntil)throw new Error('The map service is busy. Wait a minute before trying again.');
  const timeout=AbortSignal.timeout(65000),combined=AbortSignal.any([signal,timeout].filter(Boolean));
  let response;
  try {response=await fetch(OVERPASS,{method:'POST',body:new URLSearchParams({data:query}),signal:combined});}
  catch(e){if(signal?.aborted)throw e;throw new Error(timeout.aborted?'The map service timed out. Select a smaller area and retry.':'Could not reach the map data service. Check your connection and retry.');}
  if(response.status===429)blockedUntil=Date.now()+60000;
  if(!response.ok)throw new Error(response.status===429?'The map service is busy. Wait a minute before trying again.':`The map service returned ${response.status}. Try again later or select a smaller area.`);
  const length=Number(response.headers.get('content-length'));
  if(length>40*1024*1024)throw new Error('This area has too much map data. Select a smaller area.');
  const data=await response.json();
  if(data.remark)throw new Error('The map service could not return the complete area. Zoom in and retry.');
  if(!Array.isArray(data.elements)||data.elements.length>30000)throw new Error('This area has too many features. Select a smaller area.');
  cache={query,data};return data;
}
