import { clipRing, clipLines, ringArea, unproject } from './geo.js';
import { joinWays } from './osm.js';
import { unionTileRings } from './tile-seams.js';
const SIZE=4096;
function fingerprint(text){let n=14695981039346656037n;for(const c of text){n^=BigInt(c.charCodeAt(0));n=BigInt.asUintN(64,n*1099511628211n);}return n.toString(16);}
export function preparedTags(f) {
  const p=f.properties,k=p.kind;
  if(f.layer==='buildings'&&f.type===3&&k!=='building_part')return {building:'yes'};
  if(f.layer==='roads'&&f.type===2&&['highway','major_road','minor_road','path'].includes(k))return {highway:p.kind_detail||({highway:'primary',major_road:'secondary',minor_road:'residential',path:'footway'}[k]),...(p.is_bridge?{bridge:'yes'}:{})};
  if(f.layer==='water') {
    if(f.type===3)return {natural:'water',water:k==='ocean'?'sea':p.kind_detail||'lake'};
    if(f.type===2)return {waterway:['stream','canal','ditch','drain'].includes(p.kind_detail)?p.kind_detail:'river'};
  }
  if(['landuse','natural','landcover'].includes(f.layer)&&f.type===3) {
    if(['forest','wood','scrub'].includes(k))return {natural:k==='forest'?'wood':k};
    if(k==='wetland')return {natural:'wetland'};
    if(k==='farmland'&&['orchard','vineyard','pasture','meadow','farmyard'].includes(p.kind_detail))return {landuse:p.kind_detail};
    if(['farmland','farmyard','pasture','orchard','vineyard','cemetery','meadow','grass','grassland','recreation_ground'].includes(k))return {landuse:k==='grassland'?'grass':k};
    if(['park','garden','nature_reserve','national_park','golf_course','playground'].includes(k))return {leisure:k};
  }
  if(f.layer==='pois'&&f.type===1&&k==='tree')return {natural:'tree'};
  return null;
}
export class PreparedGeometry {
  constructor(z=15){this.z=z;this.groups=new Map();this.seen=new Set();this.points=[];this.vertices=0;}
  add(features,x,y) {
    for(const f of features) {
      const tags=preparedTags(f);if(!tags)continue;
      if(f.layer==='water'&&f.properties.name)tags.name=f.properties.name;
      const local=f.paths.map(path=>path.map(([a,b])=>[a*SIZE/f.extent,b*SIZE/f.extent]));
      const signature=JSON.stringify(tags),identity=f.id&&f.id!=='0'?f.id:fingerprint(signature);
      const id=`prepared-${f.layer}-${identity}-${fingerprint(signature)}`,groupKey=id;
      if(!this.groups.has(groupKey))this.groups.set(groupKey,{id,tags,type:f.type,rings:[],lines:[]});
      const group=this.groups.get(groupKey),global=p=>[Math.round(p[0]+x*SIZE),Math.round(p[1]+y*SIZE)];
      if(f.type===1){for(const path of local)for(const p of path)if(p[0]>=0&&p[1]>=0&&p[0]<SIZE&&p[1]<SIZE)this.points.push({id:`${id}-${this.points.length}`,tags,point:global(p)});continue;}
      const reverse=f.type===3&&local.find(p=>ringArea(p))&&ringArea(local.find(p=>ringArea(p)))<0;
      for(let path of local) {
        if(reverse)path=[...path].reverse();
        const clipped=f.type===3?[clipRing(path,SIZE,SIZE)]:clipLines(path,SIZE,SIZE);
        for(const part of clipped) {
          if(part.length<(f.type===3?3:2))continue;
          const points=part.map(global),key=`${groupKey}:${points.map(p=>p.join(',')).join(';')}`;
          if(this.seen.has(key))continue;this.seen.add(key);
          this.vertices+=points.length;if(this.vertices>500000)throw new Error('This selection has too much detailed geometry. Choose a smaller area.');
          (f.type===3?group.rings:group.lines).push(points);
        }
      }
    }
  }
  finish() {
    const n=2**this.z,geo=p=>{const [lon,lat]=unproject(p[0]/SIZE/n,p[1]/SIZE/n);return {lon,lat};},elements=[];
    for(const group of this.groups.values()) {
      if(group.type===1)continue;
      if(group.type===2) {
        joinWays(group.lines).forEach((points,i)=>elements.push({type:'way',id:`${group.id}-${i}`,tags:group.tags,geometry:points.map(geo)}));continue;
      }
      const rings=unionTileRings(group.rings,SIZE);if(!rings.length)continue;
      const hasOuter=rings.some(r=>ringArea(r)>0),members=rings.map((ring,i)=>({type:'way',ref:`${group.id}-${i}`,role:(ringArea(ring)>0||!hasOuter)?'outer':'inner',geometry:[...ring,ring[0]].map(geo)}));
      elements.push({type:'relation',id:group.id,tags:{type:'multipolygon',...group.tags},members});
    }
    this.points.forEach(p=>elements.push({type:'node',id:p.id,tags:p.tags,...geo(p.point)}));
    if(elements.length>30000)throw new Error('This selection has too many map features. Choose a smaller area.');
    return elements;
  }
}
