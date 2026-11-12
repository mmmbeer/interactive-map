import { settlementTypes, environmentKeys, resourceKeys } from '../generation/economy-settlements.js';
import { ancestries } from '../generation/settlement-pools-v1.js';
import { escape } from '../ui.js';
import { buildingFeatures, landFeatures, industryKeys, normalizeProfile, recommendations } from './settlement-profile.js';
const title=s=>s.replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());
const options=items=>Object.entries(items).map(([key,label])=>`<option value="${escape(key)}">${escape(label)}</option>`).join('');
const checks=(name,items)=>Object.entries(items).map(([key,label])=>`<label class="world-checkbox"><input type="checkbox" name="${name}" value="${escape(key)}">${escape(label)}</label>`).join('');
export function settlementSetupHTML() {
  return `<p class="world-step-intro">Choose what this place becomes. Suggestions are a starting point. You control what the map may add.</p>
    <label>What should this area represent?<select name="settlementType" required><option value="">Choose a settlement type…</option>${options(Object.fromEntries(Object.entries(settlementTypes).map(([k,p])=>[k,title(p.label)])))}</select></label>
    <fieldset><legend>Districts</legend>
      <label>District plan<select name="districtMode"><option value="suggested">Follow roads and water</option><option value="mapped">Use mapped boundaries</option><option value="single">One district</option></select></label>
      <label>District count<select name="districtCount"><option value="0">Automatic</option>${options(Object.fromEntries(Array.from({length:12},(_,i)=>[i+1,String(i+1)])))}</select></label><p>Suggested boundaries are editable. Mapped neighborhood polygons are often unavailable in prepared data.</p>
    </fieldset>
    <fieldset><legend>Fantasy sites to include</legend><p>Assign these uses to the selected building layer. When mapped footprints are unavailable or turned off, the system creates buildings along the generated or retained roads.</p><div class="world-feature-checks">${checks('settlementFeature',Object.fromEntries(Object.entries(buildingFeatures).map(([k,v])=>[k,v[2]])))}</div>
      <label class="world-checkbox"><input type="checkbox" name="assignBusinesses" checked> Generate a mix of shops and workshops</label></fieldset><fieldset><legend>Land the system may generate</legend><p>Add missing land uses on suitable clear ground. Retained parcels stay in place. Water, roads and building footprints stay clear.</p><div class="world-feature-checks">${checks('settlementLand',landFeatures)}</div>
      <button type="button" class="button quiet" id="world-suggest-features">Use suggestions for this settlement</button>
    </fieldset>
    <details><summary>Generated terrain</summary><p>Rainfall and prevailing wind guide generated rivers and woodland. Retained map features stay fixed.</p>
      <label>Rainfall<select name="proceduralRain"><option value="0.45">Dry</option><option value="0.9" selected>Temperate</option><option value="1.4">Wet</option></select></label>
      <label>Wind from<select name="proceduralWind"><option value="">Choose from seed</option><option value="90">North</option><option value="180">East</option><option value="270">South</option><option value="0">West</option></select></label>
    </details>
    <details><summary>Residents and ancestry</summary><fieldset><legend>Residents</legend>
      <label>Primary ancestry<select name="primaryAncestry">${options(ancestries)}</select></label>
      <div class="world-coordinates"><label>Secondary ancestry<select name="secondaryAncestry"><option value="">None</option>${options(ancestries)}</select></label><label>Secondary share (%)<input name="secondaryPercent" type="number" min="1" max="49" value="25" step="1"></label></div>
      <label>Living standards<select name="livingStandards"><option value="mixed">Mixed, mostly modest households</option><option value="modest">Modest</option><option value="comfortable">Comfortable</option><option value="wealthy">Wealthy</option></select></label>
      <label>Resident age mix<select name="ageMix"><option value="mixed">Mixed life stages</option><option value="families">Mostly established households</option><option value="working">More young and working adults</option><option value="older">More older residents</option></select></label>
      <label>Typical residents per home (optional)<input name="householdSize" type="number" min="1" max="12" step="1" placeholder="Leave blank for varied household sizes"></label><p>This is a household size, not the population of the whole settlement. Ages use ancestry-appropriate life stages.</p>
    </fieldset></details>
    <details><summary>Economy and surroundings</summary><p>Mapped water and land uses also provide local context. Leave these blank to use the settlement’s economic defaults.</p>
      <fieldset><legend>Surroundings</legend><div class="world-feature-checks">${checks('settlementEnvironment',Object.fromEntries(environmentKeys.map(k=>[k,title(k)])))}</div></fieldset>
      <label>Economic focus (optional)<select name="settlementIndustry"><option value="">Use settlement defaults</option>${options(Object.fromEntries(industryKeys.map(k=>[k,title(k)])))}</select></label>
      <label>Local resource (optional)<select name="settlementResource"><option value="">Use settlement defaults</option>${options(Object.fromEntries(resourceKeys.map(k=>[k,title(k)])))}</select></label>
    </details>`;
}
export function readSettlementSetup(form) {
  const value=name=>form.elements[name].value;
  const selected=name=>[...form.querySelectorAll(`input[name="${name}"]:checked`)].map(e=>e.value);
  return normalizeProfile({procedural:{raininess:Number(form.elements.proceduralRain?.value||.9),windAngle:form.elements.proceduralWind?.value?Number(form.elements.proceduralWind.value):null},type:value('settlementType'),ancestry:value('primaryAncestry'),secondary:value('secondaryAncestry'),secondaryPercent:value('secondaryAncestry')?Number(value('secondaryPercent')):25,wealth:value('livingStandards'),ages:value('ageMix'),householdSize:value('householdSize')?Number(value('householdSize')):null,districtMode:value('districtMode'),districtCount:Number(value('districtCount')),assignBusinesses:form.elements.assignBusinesses.checked,features:selected('settlementFeature'),landFeatures:selected('settlementLand'),environment:selected('settlementEnvironment'),industries:value('settlementIndustry')?[value('settlementIndustry')]:[],resources:value('settlementResource')?[value('settlementResource')]:[]});
}
export function suggestSettlementFeatures(form) {
  const suggested=recommendations(form.elements.settlementType.value);
  for(const [name,key] of [['settlementFeature','features'],['settlementLand','landFeatures']])for(const input of form.querySelectorAll(`input[name="${name}"]`))input.checked=suggested[key].includes(input.value);
}
