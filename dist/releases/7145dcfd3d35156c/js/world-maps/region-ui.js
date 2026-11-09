import { regionLevels } from './region-scale.js';
import { sourceGroups, sourceCounts } from './source-selection.js';
import { escape } from '../ui.js';
export const outlineExamples={iceland:{west:-25.5,south:62.9,east:-12.3,north:67.1},sicily:{west:12,south:35.3,east:15.9,north:38.5}};
const range=(p,i)=>i===0?'Up to 600 m':i===regionLevels.length-1?'Over 300 km':`Up to ${(p.max/1000).toLocaleString()} km`;
export function regionScaleHTML(plan) {
  const has=k=>plan.groups.includes(k);
  const description=has('paths')?'Use full local detail: buildings, streets and alleys, plus mapped terrain.':has('buildings')?'Use mapped buildings and city streets. Alleys and footpaths are generated.':has('roads')?'Use connecting roads and mapped terrain. Local streets and buildings are generated.':has('majorRoads')?'Use principal routes and the landscape. City streets and buildings are generated.':has('water')?'Use rivers, lakes and the landscape. Settlement roads and buildings are generated.':'Use the coastline as a silhouette. Inland terrain, rivers, roads, streets, buildings and alleys are generated for your settlement.';
  return `<strong>${escape(plan.label)}</strong><p>${escape(description)}</p><p>Missing or deselected layers are generated. Kept mapped layers are never duplicated.</p><details><summary>How region size changes source detail</summary><table><thead><tr><th>Longest side</th><th>Mapped detail</th></tr></thead><tbody>${[...regionLevels].reverse().map(p=>{const i=regionLevels.indexOf(p);return `<tr ${p.id===plan.level?'aria-current="true"':''}><td>${range(p,i)}</td><td>${escape(p.label)}</td></tr>`;}).join('')}</tbody></table><p>These thresholds use ground coverage. Changing the export resolution does not unlock more source detail.</p></details>`;
}
export function updateSourceLabels(form,survey,selection,trees=[]) {
  const plan=survey.worldImport.regionPlan,counts=sourceCounts(survey,selection,trees);
  for(const [key,c] of Object.entries(counts)) {
    const el=form.querySelector(`[data-source-count="${key}"]`),eligible=plan.groups.includes(key),optional=['farmland','burial'].includes(key);
    if(key==='coast')el.textContent=c.kept?`${c.kept.toLocaleString()} shape sections kept`:'No coastline in this cutout';
    else if(!eligible)el.textContent=optional?'Not used at this scale · add parcels in step 3':'Generated · zoom in to use mapped detail';
    else if(!selection.groups.includes(key))el.textContent=optional?'Mapped parcels omitted · generation follows step 3':'Generate a replacement · mapped layer turned off';
    else if(!c.kept)el.textContent=optional?'None retained · generation follows step 3':`${c.total.toLocaleString()} found · none retained · generate instead`;
    else el.textContent=`${c.total.toLocaleString()} found · ${c.kept.toLocaleString()} kept · no generated duplicates`;
  }
}
