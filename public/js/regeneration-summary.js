export const defaultRegenerationMode=source=>source.worldImport?.bounds?'layout':'content';
const buildingCategories=new Set(['home','shop','workshop','tavern','temple','guild','harbor']);

export function regenerationSummary(map) {
  const buildings=map.locations.filter(p=>p.worldStyle?.kind==='building'||buildingCategories.has(p.category)),streets=map.locations.filter(p=>p.category==='street');
  const alleys=streets.filter(p=>p.type==='alley'||p.worldStyle?.roadClass==='alley');
  const businesses=buildings.filter(p=>['shop','workshop'].includes(p.category));
  const planner=map.worldImport?.procedural?.planner,target=planner?.metrics?.buildingTarget||planner?.settlement?.input?.population/(planner?.settlement?.options?.development?.centreOccupancy||4)||0;
  const warnings=[...(map.worldImport?.planning?.warnings||[])];
  const generated=map.worldImport?.procedural?.decisions?.buildings?.mode==='generated';
  if(generated&&target>0&&buildings.length<target*.6)warnings.unshift(`Only ${buildings.length.toLocaleString()} of about ${Math.round(target).toLocaleString()} planned buildings fit. Review the layout and retained terrain before saving.`);
  return {buildings:buildings.length,homes:buildings.filter(p=>p.category==='home').length,businesses:businesses.length,roads:streets.length-alleys.length,alleys:alleys.length,target:Math.round(target),warnings:[...new Set(warnings)]};
}
