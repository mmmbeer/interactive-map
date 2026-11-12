import { sourceGroup, sourceGroups } from './source-selection.js';
import { generateEngineLayout } from './planner/pipeline-v4.js';
import { generateOrganicLayout } from './planner/pipeline.js';
const layers=['water','woodland','openland','majorRoads','roads','cityStreets','paths','buildings'];
export function layoutDecisions(map,selection) {
  const available=map.worldImport.regionPlan.groups;
  return Object.fromEntries(layers.map(group=>{
    const kept=map.locations.filter(p=>p.worldStyle?.origin!=='generated'&&sourceGroup(p)===group).length+(group==='woodland'&&selection.groups.includes('woodland')?(map.worldImport.mappedTreeCount||0):0);
    const reason=kept?'mapped':!available.includes(group)?'scale':!selection.groups.includes(group)?'deselected':'missing';
    return [group,{source:kept,mode:kept?'mapped':'generated',reason}];
  }));
}
export function generateLayout(map,selection,profile,onProgress,version=4) {
  const warnings=[],decisions=layoutDecisions(map,selection),needs=group=>decisions[group]?.mode==='generated';
  const availableTrees=map.worldImport.mappedTreeCount||0;
  if(availableTrees&&selection.groups.includes('woodland'))decisions.woodland={source:availableTrees,mode:'mapped',reason:'mapped'};
  const planner=(version===3?generateOrganicLayout:generateEngineLayout)(map,needs,profile,warnings,onProgress);
  for(const [key,d] of Object.entries(decisions)) {
    d.generated=map.locations.filter(p=>p.worldStyle?.origin==='generated'&&sourceGroup(p)===key).length;
    d.label=sourceGroups[key].label;
  }
  map.worldImport.procedural={version,elevation:version===3?'warped-simplex-drainage-v2':'mapgen4-climate-v1',decisions,warnings,planner};
  return map;
}
