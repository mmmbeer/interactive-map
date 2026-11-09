// Source choices are applied before fantasy planning and saved in atlas backups.
export const sourceGroups={
  buildings:{label:'Building footprints',note:'Turn real buildings into homes, shops and selected fantasy sites.',color:'#343e3b'},
  roads:{label:'Streets and bridges',note:'Keep the street layout. Modern road labels are removed.',color:'#a96e35'},
  paths:{label:'Paths and tracks',note:'Keep walking routes, farm tracks and steps.',color:'#ac8964'},
  water:{label:'Rivers, lakes and coastline',note:'Always kept so shores, districts and new plots respect the water.',color:'#6b9fad'},
  woodland:{label:'Woods, wetlands and trees',note:'Keep mapped forests, scrub and marshes.',color:'#648258'},
  farmland:{label:'Fields, pasture and orchards',note:'Keep existing agricultural parcels and their uses.',color:'#b49742'},
  openland:{label:'Parks and open ground',note:'Reinterpret mapped green spaces as fantasy terrain.',color:'#9da77d'},
  burial:{label:'Burial grounds',note:'Keep mapped cemeteries as searchable burial sites.',color:'#8b7592'}
};
export function sourceGroup(p) {
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
  return {groups:[...new Set([...groups,'water'])].sort(),excluded:[...new Set(excluded)].sort(),buildingUses:input.buildingUses==='mapped'?'mapped':'fantasy'};
}
export function keepSource(p,selection) {
  const group=sourceGroup(p);
  return group==='water'||selection.groups.includes(group)&&!selection.excluded.includes(p.id);
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
  if(!map.locations.length)throw new Error('Keep at least one source feature. Select a feature group or restore a removed feature.');
  if(selection.buildingUses==='fantasy')for(const p of map.locations)if(p.worldStyle?.kind==='building'){p.category='home';p.type='home';}
  map.worldImport.sourceSelection={version:1,...selection};
  return selection;
}
