// Keep OSM relation rings and their courtyards. Never treat an open way as an area.
import { ringContains } from '../geometry.js';
const same=(a,b)=>a&&b&&a[0]===b[0]&&a[1]===b[1];
export const coordinates=geometry=>(geometry||[]).filter(p=>Number.isFinite(p.lon)&&Number.isFinite(p.lat)).map(p=>[p.lon,p.lat]);
export function joinWays(segments,{directed=false}={}) {
  const rest=segments.filter(s=>s.length>1).map(s=>s.slice()),chains=[];
  while(rest.length) {
    let chain=rest.pop(),changed=true;
    while(changed&&!same(chain[0],chain.at(-1))) {
      changed=false;
      for(let i=0;i<rest.length;i++) {
        let part=rest[i];
        if(same(chain.at(-1),part[0]))chain.push(...part.slice(1));
        else if(same(part.at(-1),chain[0]))chain=part.slice(0,-1).concat(chain);
        else if(!directed&&same(chain.at(-1),part.at(-1)))chain.push(...part.slice(0,-1).reverse());
        else if(!directed&&same(part[0],chain[0]))chain=part.slice(1).reverse().concat(chain);
        else continue;
        rest.splice(i,1);changed=true;break;
      }
    }chains.push(chain);
  }return chains;
}
export function polygons(element) {
  if(element.type==='way') {
    const points=coordinates(element.geometry);return points.length>3&&same(points[0],points.at(-1))?[{points:points.slice(0,-1),holes:[]}]:[];
  }
  if(element.type!=='relation')return [];
  const members=(element.members||[]).filter(m=>m.type==='way'),closed=role=>joinWays(members.filter(m=>(m.role||'outer')===role).map(m=>coordinates(m.geometry))).filter(r=>r.length>3&&same(r[0],r.at(-1))).map(r=>r.slice(0,-1));
  const outer=closed('outer'),inner=closed('inner');
  return outer.map(points=>({points,holes:inner.filter(r=>r.every(([x,y])=>ringContains(points,x,y)))}));
}
export function featureKind(tags={}) {
  if(tags.building&&tags.building!=='no')return 'building';
  if(tags.natural==='coastline')return 'coast';
  if(tags.highway&&!['proposed','construction'].includes(tags.highway))return 'road';
  if(tags.natural==='water'||tags.waterway==='riverbank')return 'water';
  if(tags.waterway&&['river','stream','canal','ditch','drain'].includes(tags.waterway))return 'river';
  if(tags.natural==='tree')return 'tree';
  if(['wood','scrub','wetland'].includes(tags.natural)||tags.landuse||tags.leisure)return 'terrain';
  return null;
}
