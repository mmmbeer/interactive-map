// Source choices are applied before fantasy planning and saved in atlas backups.
export const sourceGroups={
  coast:{label:'Coastline and land shape',note:'Keep the selected land silhouette. Inland water can be replaced separately.',color:'#577e8e'},
  water:{label:'Rivers and lakes',note:'Use mapped inland water, or generate waterways that fit the terrain.',color:'#6b9fad'},
  majorRoads:{label:'Major routes',note:'Use main real-world routes as the settlement’s principal approaches.',color:'#996027'},
  roads:{label:'Connecting roads',note:'Keep regional and connecting routes. Generate them when absent or turned off.',color:'#a96e35'},
  cityStreets:{label:'City streets',note:'Keep local street geometry. A retained street layer suppresses generated streets.',color:'#be945a'},
  buildings:{label:'Building footprints',note:'Turn real buildings into homes, shops and selected fantasy sites.',color:'#343e3b'},
  paths:{label:'Alleys and footpaths',note:'Keep walking routes, farm tracks and steps.',color:'#ac8964'},
  woodland:{label:'Woods, wetlands and trees',note:'Keep mapped forests, scrub and marshes.',color:'#648258'},
  farmland:{label:'Fields, pasture and orchards',note:'Keep existing agricultural parcels and their uses.',color:'#b49742'},
  openland:{label:'Parks and open ground',note:'Reinterpret mapped green spaces as fantasy terrain.',color:'#9da77d'},
  burial:{label:'Burial grounds',note:'Keep mapped cemeteries as searchable burial sites.',color:'#8b7592'}
};
export function sourceGroup(p) {
  if(Object.hasOwn(sourceGroups,p.worldStyle?.sourceGroup))return p.worldStyle.sourceGroup;
  if(p.worldStyle?.kind==='building')return 'buildings';
  if(p.category==='water')return 'water';
  if(p.category==='street')return p.type==='trail'?'paths':'roads';
  const use=p.worldStyle?.landuse;
  if(use==='cemetery'||p.type==='cemetery')return 'burial';
  if(['farmland','farmyard','pasture','orchard','vineyard'].includes(use))return 'farmland';
  if(['forest','wood','scrub','wetland'].includes(use)||['forest','marsh'].includes(p.type))return 'woodland';
  return 'openland';
}
export function normalizeSourceSelection(input={}) {
  const groups=input.groups??Object.keys(sourceGroups),excluded=input.excluded??[];
  if(!Array.isArray(groups)||groups.some(k=>!Object.hasOwn(sourceGroups,k)))throw new Error('Choose supported source features.');
  if(!Array.isArray(excluded)||excluded.some(id=>typeof id!=='string'))throw new Error('Choose valid features to leave out.');
  if(input.buildingUses!==undefined&&!['fantasy','mapped'].includes(input.buildingUses))throw new Error('Choose how to assign building uses.');
  const version=input.version===2?2:1;
  return {version,groups:[...new Set([...groups,version===2?'coast':'water'])].sort(),excluded:[...new Set(excluded)].sort(),buildingUses:input.buildingUses==='mapped'?'mapped':'fantasy'};
}
export function keepSource(p,selection) {
  const group=sourceGroup(p);
  return group===(selection.version===2?'coast':'water')||selection.groups.includes(group)&&!selection.excluded.includes(p.id);
}
export function sourceCounts(map,selection,trees=[]) {
  return Object.fromEntries(Object.keys(sourceGroups).map(key=>{
    const places=map.locations.filter(p=>sourceGroup(p)===key);
    const treeCount=key==='woodland'?trees.length:0;
    return [key,{total:places.length+treeCount,kept:places.filter(p=>keepSource(p,selection)).length+(selection.groups.includes(key)?treeCount:0)}];
  }));
}
export function selectSource(map,input) {
  const selection=normalizeSourceSelection(input);
  map.locations=map.locations.filter(p=>keepSource(p,selection));
  if(map.locationAliases) {
    const ids=new Set(map.locations.map(p=>p.id));
    map.locationAliases=Object.fromEntries(Object.entries(map.locationAliases).filter(([,to])=>ids.has(to)));
  }
  if(!map.locations.length&&selection.version!==2)throw new Error('Keep at least one source feature. Select a feature group or restore a removed feature.');
  if(selection.buildingUses==='fantasy')for(const p of map.locations)if(p.worldStyle?.kind==='building'){p.category='home';p.type='home';}
  map.worldImport.sourceSelection={...selection};
  return selection;
}
