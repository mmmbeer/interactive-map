import { sourceGroup, sourceGroups } from './source-selection.js';
import { generateLandscape } from './procedural-terrain.js';
import { generateStreets } from './procedural-streets.js';
import { generateBuildings } from './procedural-buildings.js';
import { settlementGrid } from './settlement-grid.js';
import { clearPlots } from './settlement-enrichment.js';
const layers=['water','woodland','openland','majorRoads','roads','cityStreets','paths','buildings'];
export function layoutDecisions(map,selection) {
  const available=map.worldImport.regionPlan.groups;
  return Object.fromEntries(layers.map(group=>{
    const kept=map.locations.filter(p=>p.worldStyle?.origin!=='generated'&&sourceGroup(p)===group).length+(group==='woodland'&&selection.groups.includes('woodland')?(map.worldImport.mappedTreeCount||0):0);
    const reason=kept?'mapped':!available.includes(group)?'scale':!selection.groups.includes(group)?'deselected':'missing';
    return [group,{source:kept,mode:kept?'mapped':'generated',reason}];
  }));
}
export function generateLayout(map,selection,profile) {
  const warnings=[],decisions=layoutDecisions(map,selection),needs=group=>decisions[group]?.mode==='generated';
  const availableTrees=map.worldImport.mappedTreeCount||0;
  if(availableTrees&&selection.groups.includes('woodland'))decisions.woodland={source:availableTrees,mode:'mapped',reason:'mapped'};
  generateLandscape(map,needs,warnings);generateStreets(map,needs,profile,warnings);
  // Reserve requested rural parcels before houses occupy the available blocks.
  clearPlots(map,settlementGrid(map),profile,warnings);
  if(needs('buildings'))generateBuildings(map,profile,warnings);
  for(const [key,d] of Object.entries(decisions)) {
    d.generated=map.locations.filter(p=>p.worldStyle?.origin==='generated'&&sourceGroup(p)===key).length;
    d.label=sourceGroups[key].label;
  }
  map.worldImport.procedural={version:1,elevation:'seeded-value-noise-v1',decisions,warnings};
  return map;
}
