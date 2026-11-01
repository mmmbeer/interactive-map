import { escape } from '../ui.js';
import { resolveLocation } from '../generation/locations.js';
import { householdTypes } from '../generation/social/household-types.js';
const select=(key,label,values,current='')=>`<label>${label}<select name="${key}">${values.map(([id,name])=>`<option value="${escape(id)}"${id===current?' selected':''}>${escape(name)}</option>`).join('')}</select></label>`;
export function socialForm(map,place) {
  if(map.generator?.socialVersion!==1 || !['home','shop','workshop','tavern','guild','temple','harbor'].includes(place.category))return '';
  const s=place.generation?.social || {},home=place.category==='home',key=home?'workplace':'home',selected=s[key] || '';
  const candidates=map.locations.filter(p=>p.id!==place.id && (home?['shop','workshop','tavern','guild','temple','harbor'].includes(p.category):p.category==='home') && (p.district===place.district || p.id===selected));
  const shown=candidates.filter(p=>p.id!==selected).slice(0,120);if(selected && candidates.some(p=>p.id===selected))shown.unshift(candidates.find(p=>p.id===selected));
  const choices=[['','Choose from context'],...shown.map(p=>[p.id,resolveLocation(map,p,undefined,undefined,'identity').name])];
  return `<fieldset class="editor-wide"><legend>Shared residents and households</legend><div class="editor-grid">
    ${select('socialEnabled','Connected generation',[['','Inherit'],['yes','Enabled'],['no','Disabled']],s.enabled===undefined?'':s.enabled?'yes':'no')}
    ${select('social-'+key,home?'Primary resident’s workplace':'Keeper’s residence',choices,selected)}
    ${home?select('householdStyle','Household structure',[['','Choose from context'],...Object.entries(householdTypes).map(([id,t])=>[id,t.label])],s.householdStyle || ''):''}
    <label>Shared name for an authored profile<input name="socialPersonName" value="${escape(s.personName || '')}" placeholder="Optional full name"></label>
    </div><small>Population sets household size. Links use compatible adult residents. Nearby choices show up to 120 sites in this district. Other stable IDs can be entered in advanced settings. Give an authored person a shared name to connect that profile to a household.</small></fieldset>`;
}
export function readSocial(data,generation,original) {
  if(!data.has('socialEnabled'))return;
  const s={...generation.social},old=original.generation?.social || {},value=k=>String(data.get(k) || '');
  if(value('socialEnabled'))s.enabled=value('socialEnabled')==='yes';else if(s.enabled===old.enabled)delete s.enabled;
  for(const [key,field] of Object.entries({home:'social-home',workplace:'social-workplace',householdStyle:'householdStyle',personName:'socialPersonName'}))if(data.has(field)) {
    if(value(field).trim())s[key]=value(field).trim();else if(s[key]===old[key])delete s[key];
  }
  if(Object.keys(s).length)generation.social=s;else delete generation.social;
}
export function removeSocialReference(place,id) {
  const s=place.generation?.social;if(!s)return;
  for(const key of ['home','workplace'])if(s[key]===id)delete s[key];
}
