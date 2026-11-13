import { integrationSearchTerms } from './integrations/config.js';
import { boundsFor, contains } from './geometry.js';
// Image-space indexing keeps thousands of building hit areas inexpensive to query.
export function buildSpatialIndex(locations, cellSize = 32) {
  if(!Number.isFinite(cellSize)||cellSize<=0)throw new Error('Invalid spatial cell size.');
  const cells = new Map(),large=[];
  for (const place of locations) {
    const [x,y,w,h] = boundsFor(place);
    const columns=Math.floor((x+w)/cellSize)-Math.floor(x/cellSize)+1;
    const rows=Math.floor((y+h)/cellSize)-Math.floor(y/cellSize)+1;
    // Large water/terrain polygons belong in one fallback list, not thousands of cells.
    if(!Number.isFinite(columns*rows)||columns*rows>64){large.push(place);continue;}
    for (let gx=Math.floor(x/cellSize);gx<=Math.floor((x+w)/cellSize);gx++) {
      for (let gy=Math.floor(y/cellSize);gy<=Math.floor((y+h)/cellSize);gy++) {
        const key=`${gx},${gy}`;
        if (!cells.has(key)) cells.set(key,[]);
        cells.get(key).push(place);
      }
    }
  }
  return {cells,cellSize,large,featured:locations.filter(p=>p.featured)};
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
  let nearest=null,smallest=Infinity;
  for(const group of [candidates,index.large||[]])for(const p of group) {
    if(!predicate(p)||!contains(p,x,y))continue;
    const b=boundsFor(p),area=b[2]*b[3];
    if(area<smallest){nearest=p;smallest=area;}
  }
  return nearest;
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
