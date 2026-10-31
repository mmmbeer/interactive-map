import { integrationSearchTerms } from './integrations/config.js';
import { boundsFor, contains } from './geometry.js';
// Image-space indexing keeps thousands of building hit areas inexpensive to query.
export function buildSpatialIndex(locations, cellSize = 32) {
  const cells = new Map();
  for (const place of locations) {
    const [x,y,w,h] = boundsFor(place);
    for (let gx=Math.floor(x/cellSize);gx<=Math.floor((x+w)/cellSize);gx++) {
      for (let gy=Math.floor(y/cellSize);gy<=Math.floor((y+h)/cellSize);gy++) {
        const key=`${gx},${gy}`;
        if (!cells.has(key)) cells.set(key,[]);
        cells.get(key).push(place);
      }
    }
  }
  return {cells,cellSize,featured:locations.filter(p=>p.featured)};
}
export function hitTest(index,locations,x,y,scale=1,predicate=()=>true,markers=true,pinVisible=()=>true) {
  if (markers) {
    let nearest=null, distance=18/scale;
    for (const p of index.featured) {
      if (!predicate(p) || !pinVisible(p)) continue;
      const d=Math.hypot(p.x-x,p.y-y);
      if (d<distance) { nearest=p; distance=d; }
    }
    if (nearest) return nearest;
  }
  const candidates=index.cells.get(`${Math.floor(x/index.cellSize)},${Math.floor(y/index.cellSize)}`)||[];
  return candidates.filter(p=>{
    if (!predicate(p)) return false;
    return contains(p,x,y);
  }).sort((a,b)=>{
    const area=p=>{ const b=boundsFor(p); return b[2]*b[3]; };
    return area(a)-area(b);
  })[0]||null;
}
const searchCache = new WeakMap();
const normalizeSearch=value=>String(value).toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
function searchText(place) {
  if (!searchCache.has(place)) searchCache.set(place,normalizeSearch([place.id,place.name,place.category,place.type,integrationSearchTerms(place),place.district,place.description,place.rumor,place.person,place.address,place.services,...Object.values(place.extra||{}).map(s=>s.text),...Object.values(place.demographics||{})].join(' ')));
  return searchCache.get(place);
}
export function matches(place,{query='',category='',district=''}={}) {
  return (!category||place.category===category)&&(!district||place.district===district)&&
    (!query||searchText(place).includes(normalizeSearch(query)));
}
export async function searchPlaces(places,filters,{signal,current=()=>true,batchSize=80}={}) {
  const result=[];
  for (let i=0;i<places.length;i++) {
    if (signal?.aborted || !current()) return null;
    if (matches(places[i],filters)) result.push(places[i]);
    // The first full-text search may resolve thousands of stories. Yield to input.
    if (filters.query && (i+1)%batchSize===0) await new Promise(resolve=>setTimeout(resolve,0));
  }
  return result;
}
