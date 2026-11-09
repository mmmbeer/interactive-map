import { escape } from '../ui.js';
import { keepSource } from './source-selection.js';
import { buildingFeatures, landFeatures } from './settlement-profile.js';
export function planSummary(survey,selection,profile) {
  const kept=survey.locations.filter(p=>keepSource(p,selection));
  const buildings=kept.filter(p=>p.worldStyle?.kind==='building').length;
  const sites=profile.features.map(k=>buildingFeatures[k][2].toLowerCase());
  const land=profile.landFeatures.map(k=>landFeatures[k].toLowerCase());
  const notes=[];
  if(['hamlet','village','farming_village','mining_outpost','caravan_stop'].includes(profile.type)&&buildings>150)notes.push(`This region contains ${buildings.toLocaleString()} building footprints. A small-settlement theme changes their uses, not their number. For a smaller settlement, tighten the frame or leave out some footprints in step 2.`);
  if(['city','metropolis'].includes(profile.type)&&buildings<30&&buildings>0)notes.push('Few building footprints are kept for a city. Keep more buildings or choose a larger built-up region if you want a denser city map.');
  if(!buildings)notes.push('No building footprints are kept. This map can show terrain, but the system cannot place homes or fantasy buildings. Return to step 2 to keep buildings, or choose a different region.');
  else if(buildings<profile.features.length)notes.push('There are fewer buildings than requested sites. Some sites may not fit.');
  if(!kept.some(p=>p.category==='street'))notes.push('No roads or paths are kept. Suggested districts will follow the remaining geography.');
  if(profile.type==='port'&&!kept.some(p=>p.category==='water'&&['river','canal','lake','sea','bay','channel','strait'].includes(p.type)))notes.push('A port needs navigable water. This region has none in the source data. Choose a waterfront region or another settlement type.');
  return `<strong>Your map will use ${buildings.toLocaleString()} building footprints</strong><p>${escape(sites.length?`Establish ${sites.join(', ')} in suitable footprints.`:'No extra fantasy sites requested.')} ${escape(land.length?`Look for clear ground for ${land.join(', ')}.`:'No additional farmland or burial parcels requested.')}</p><p>Buildings keep their shapes and positions. Missing sites are reported after preview. No new roads, rivers or building footprints are invented.</p>${notes.map(t=>`<p class="world-advice">${escape(t)}</p>`).join('')}`;
}
export function resultSummary(map) {
  const added=map.locations.filter(p=>p.worldStyle?.established),buildings=map.locations.filter(p=>p.worldStyle?.kind==='building');
  const actual=map.worldImport.settlement,items=[];
  for(const key of actual.features) {
    const [,,label]=buildingFeatures[key],type=buildingFeatures[key][1];
    items.push([label,map.locations.some(p=>p.type===type)?'Included':'Could not place']);
  }
  for(const key of actual.landFeatures)items.push([landFeatures[key],map.locations.some(p=>p.type===key||key==='graveyard'&&p.type==='cemetery')?'Included':'Could not place']);
  return `<h3>Review your fantasy map</h3><p>${buildings.length.toLocaleString()} buildings · ${map.districts.length} districts · ${added.length} fantasy additions. ${map.width.toLocaleString()} × ${map.height.toLocaleString()} px.</p>${items.length?`<dl>${items.map(([label,value])=>`<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>`:''}${map.worldImport.planning.warnings.map(t=>`<p class="world-advice">${escape(t)}</p>`).join('')}<p>Adjust any choice and create another preview. Save on this browser or download an atlas backup to preserve the image, features and settings.</p>`;
}
