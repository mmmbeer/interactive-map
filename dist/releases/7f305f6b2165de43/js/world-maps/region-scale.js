import { checkRegion, project } from './geo.js';
// Eligibility follows ground coverage, not device pixels or the navigation zoom.
export const regionLevels=[
  {id:'block',label:'Block detail',max:600,zoom:15,groups:['coast','water','woodland','majorRoads','roads','cityStreets','buildings','paths','farmland','openland','burial']},
  {id:'city',label:'City detail',max:2000,zoom:15,groups:['coast','water','woodland','majorRoads','roads','cityStreets','buildings','farmland','openland','burial']},
  {id:'town',label:'Town and surroundings',max:8000,zoom:13,groups:['coast','water','woodland','majorRoads','roads','farmland','openland']},
  {id:'region',label:'Regional routes',max:40000,zoom:11,groups:['coast','water','woodland','majorRoads']},
  {id:'landscape',label:'Landscape',max:300000,zoom:9,groups:['coast','water','woodland']},
  {id:'shape',label:'Geographic shape',max:Infinity,zoom:6,groups:['coast']}
];
export const canonicalBounds=b=>Object.fromEntries(['west','south','east','north'].map(k=>[k,Math.round(b[k]*1e7)/1e7]));
export function tileCoverage(bounds,z) {
  const n=2**z,[l,t]=project(bounds.west,bounds.north),[r,b]=project(bounds.east,bounds.south);
  const left=Math.max(0,Math.floor(l*n)),right=Math.min(n-1,Math.ceil(r*n)-1),top=Math.max(0,Math.floor(t*n)),bottom=Math.min(n-1,Math.ceil(b*n)-1);
  return {left,right,top,bottom,count:Math.max(0,right-left+1)*Math.max(0,bottom-top+1)};
}
export function regionPlan(bounds) {
  const area=checkRegion(bounds),span=Math.max(area.width,area.height),level=regionLevels.find(p=>span<=p.max);
  let zoom=level.zoom;while(zoom>0&&tileCoverage(bounds,zoom).count>64)zoom--;
  const minimumZoom={water:4,woodland:7,majorRoads:9,roads:12,cityStreets:14,buildings:15,paths:15,farmland:12,openland:12,burial:15};
  const groups=level.groups.filter(k=>zoom>=(minimumZoom[k]||0));
  return {version:1,level:level.id,label:level.label,spanMeters:span,sourceWidthMeters:area.width,sourceHeightMeters:area.height,km2:area.km2,zoom,groups,liveEligible:area.km2<=36&&span<=8000,reinterpret:span>8000};
}
export function sourceClass(tags={}) {
  if(tags.natural==='coastline'||tags.water==='sea')return 'coast';
  if(tags.building&&tags.building!=='no')return 'buildings';
  if(tags.highway) {
    if(['motorway','trunk','primary','motorway_link','trunk_link','primary_link'].includes(tags.highway))return 'majorRoads';
    if(['secondary','tertiary','secondary_link','tertiary_link'].includes(tags.highway))return 'roads';
    if(['path','footway','steps','track','cycleway','pedestrian','service'].includes(tags.highway))return 'paths';
    return 'cityStreets';
  }
  if(tags.natural==='water'||tags.waterway)return 'water';
  if(['wood','scrub','wetland','tree'].includes(tags.natural)||tags.landuse==='forest')return 'woodland';
  if(['farmland','farmyard','pasture','orchard','vineyard'].includes(tags.landuse))return 'farmland';
  if(tags.landuse==='cemetery')return 'burial';
  return 'openland';
}
export const sourceAllowed=(tags,plan)=>plan.groups.includes(sourceClass(tags));
export const settlementWidths={hamlet:450,village:850,farming_village:1200,town:1800,city:3500,metropolis:6500,port:2800,mining_outpost:700,forest_hold:1100,fortress:1000,monastery:700,academy:1100,caravan_stop:650,undercity:1600};
export function applyRegionScale(map,profile,reinterpret=true) {
  const plan=map.worldImport.regionPlan;
  const resized=plan.reinterpret&&reinterpret,width=resized?settlementWidths[profile.type]:plan.sourceWidthMeters;
  map.worldImport.distanceScale={version:1,reinterpreted:resized,sourceWidthMeters:plan.sourceWidthMeters,fantasyWidthMeters:width};
  map.measurement.metersPerPixel=width/map.width;
  if(resized)for(const p of map.locations)if(p.category==='street'&&p.shape.kind==='polyline') {
    const pixels=({majorRoads:19,roads:12,cityStreets:8,paths:4})[p.worldStyle?.sourceGroup]||8;
    p.worldStyle.sourceWidth=p.shape.width;p.shape.width=pixels*map.width/4096*(map.worldImport.settings.roadWidth||1);
  }
}
