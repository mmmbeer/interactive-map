import { escape, categories } from '../ui.js';
import { catalogFor, configFor, districtList, availableFields } from '../generation/config.js';
import { nameStyles } from '../generation/locations-v2.js';
import { versionFor } from '../generation/config.js';
import { resolveLocation } from '../generation/locations.js';
const options = (values,selected) => values.map(v=>`<option value="${escape(typeof v==='object'?v.id:v)}" ${(typeof v==='object'?v.id:v)===selected?'selected':''}>${escape(typeof v==='object'?v.name:v)}</option>`).join('');
const input = (key,title,value,type='text',extra='') => `<label>${title}<input name="${key}" type="${type}" value="${escape(value ?? '')}" ${extra}></label>`;
const select = (key,title,values,value) => `<label>${title}<select name="${key}">${options(values,value)}</select></label>`;
export function placeForm(map,place,isNew) {
  const fields=availableFields(map),c=catalogFor(map,{generation:{version:2}}),g=place.generation || {},d=g.demographics || {},setting=configFor(map,place).config;
  const inherit=[{id:'',name:'Inherit from district / map'}];
  const choices=list=>[...inherit,...list];
  return `<div class="editor-grid">
    ${input('id','Stable ID',place.id,'text',isNew?'required pattern="[a-z0-9]+(-[a-z0-9]+)*"':'readonly')}
    ${select('district','District',districtList(map),place.district)}
    ${select('version','Generator',[{id:'1',name:'Version 1 (preserve existing)'},{id:'2',name:'Version 2 (expanded names)'}],String(versionFor(map,place)))}
    ${select('nameStyle','Naming pattern (version 2)',[{id:'',name:'Mixed patterns'},...nameStyles],g.nameStyle || '')}
    ${select('category','Category',Object.entries(categories).map(([id,v])=>({id,name:v.singular})),place.category)}
    ${select('type','Location type',Object.entries(c.types).filter(([,t])=>t.category===place.category).map(([id,t])=>({id,name:t.label})),place.type || place.category)}
    ${input('x','X · image pixels',place.x,'number','required step="any" min="0"')}
    ${input('y','Y · image pixels',place.y,'number','required step="any" min="0"')}
    ${select('shape','Hit shape',['point','rectangle','ellipse','polygon','polyline'],place.shape?.kind || (place.bounds?'rectangle':'point'))}
    <label class="check-label"><input type="checkbox" name="featured" ${place.featured?'checked':''}>Show as a highlight</label>
    <div class="shape-inputs editor-wide"><label>Shape coordinates (JSON)<textarea name="geometry" rows="2" spellcheck="false">${escape(JSON.stringify(['polygon','polyline'].includes(place.shape?.kind) ? place.shape.points : place.shape?.kind==='ellipse' ? [place.shape.rx,place.shape.ry] : place.bounds || [place.x-5,place.y-5,10,10]))}</textarea></label><small>Rectangle: [left, top, width, height]. Ellipse: [radius X, radius Y]. Polygon or route: [[x, y], …]. Point needs no coordinates.</small></div>
    <label class="editor-wide" data-polygon-holes ${place.shape?.kind==='polygon'?'':'hidden'}>Excluded areas (JSON rings)<textarea name="holes" rows="2" spellcheck="false">${escape(JSON.stringify(place.shape?.holes || []))}</textarea><small>Optional polygon rings, for islands inside a sea or courtyards inside an area.</small></label>
    <div data-route-width ${place.shape?.kind==='polyline'?'':'hidden'}>${input('lineWidth','Route width (image pixels)',place.shape?.width || 6,'number','min="0.1" step="any"')}</div>
    <fieldset class="editor-wide"><legend>Geographic context (version 2)</legend><p>Link saved features so names, addresses and lore use the same geography.</p><div class="editor-grid">${['street','water','terrain','landmark'].map(key=>select('context-'+key,key[0].toUpperCase()+key.slice(1),[{id:'',name:'No linked feature'},...map.locations.filter(p=>p.id!==place.id && p.category===key).map(p=>({id:p.id,name:resolveLocation(map,p).name}))],place.context?.[key] || '')).join('')}</div></fieldset>
    <fieldset class="editor-wide editor-demographics"><legend>Demographics</legend><p>These choices drive names and resident profiles. Inherited choices use weighted map and district settings.</p><div class="editor-grid">
    ${select('race','Race',choices(Object.keys(c.people)),d.race || '')}
    ${select('gender','Resident gender',choices(['female','male','nonbinary']),d.gender || '')}
    ${select('age','Age group',choices([...new Set(['young_adult','adult','elder',...Object.keys(setting.demographics.ages || {}),d.age].filter(Boolean))]),d.age || '')}
    ${select('culture','Naming culture',choices(['ancestral',...Object.keys(c.cultures)]),d.culture || '')}
    ${select('wealth','Wealth',choices([...new Set(['modest','comfortable','wealthy',...Object.keys(setting.demographics.wealths || {}),d.wealth].filter(Boolean))]),d.wealth || '')}
    ${input('population','Population (optional)',d.population,'number','min="0" step="1"')}
    </div></fieldset>
    ${input('seed','Location seed (optional)',g.seed ?? '')}${input('revision','Variation',g.revision || 0,'number','min="0" step="1" required')}
    <fieldset class="editor-wide"><legend>Generated content</legend><div class="editor-checks">${fields.map(f=>`<label><input type="checkbox" name="field-${f}" ${(g.fields || setting.fields).includes(f)?'checked':''}>${f}</label>`).join('')}</div><small>A text override takes priority. A blank override deliberately hides that field.</small></fieldset>
    <details class="editor-wide"><summary>Text overrides</summary><div class="override-fields">${fields.map(f=>`<label><span><input type="checkbox" name="override-${f}" ${Object.hasOwn(place.overrides || {},f)?'checked':''}>Override ${f}</span><textarea name="text-${f}" rows="2">${escape(place.overrides?.[f] ?? '')}</textarea></label>`).join('')}</div></details>
    <details class="editor-wide"><summary>Advanced location settings</summary><p>Weighted demographics, traits and template tables. Values here are preserved when using the form.</p><label>Generation settings (JSON)<textarea name="advanced" rows="6" spellcheck="false">${escape(JSON.stringify(g,null,2))}</textarea></label><small>Advanced values apply first. Explicit demographic form choices take priority. Blank choices preserve distributions entered here.</small></details>
  </div>`;
}
export function readPlace(form,original) {
  const fields=JSON.parse(form.dataset.availableFields);
  const data=new FormData(form),value=k=>String(data.get(k) ?? '');
  const place=structuredClone(original);
  Object.assign(place,{id:value('id').trim(),district:value('district'),category:value('category'),type:value('type'),x:Number(value('x')),y:Number(value('y')),featured:data.has('featured')});
  delete place.bounds;delete place.shape;
  const kind=value('shape');
  if (kind==='rectangle') place.bounds=JSON.parse(value('geometry'));
  if (kind==='ellipse') { const [rx,ry]=JSON.parse(value('geometry'));place.shape={kind,rx,ry}; }
  if (['polygon','polyline'].includes(kind)) place.shape={kind,points:JSON.parse(value('geometry'))};
  if(kind==='polygon') {const holes=JSON.parse(value('holes') || '[]');if(!Array.isArray(holes))throw new Error('Excluded areas must be an array of polygon rings.');if(holes.length)place.shape.holes=holes;}
  if (kind==='polyline') place.shape.width=Number(value('lineWidth'));
  place.context=Object.fromEntries(['street','water','terrain','landmark'].filter(k=>value('context-'+k)).map(k=>[k,value('context-'+k)]));
  if (!Object.keys(place.context).length) delete place.context;
  const generation=JSON.parse(value('advanced') || '{}');
  if (!generation || typeof generation!=='object' || Array.isArray(generation)) throw new Error('Advanced settings must be an object.');
  generation.demographics ||= {};
  generation.version=Number(value('version'));
  if (value('nameStyle')) generation.nameStyle=value('nameStyle');else delete generation.nameStyle;
  const originalD=original.generation?.demographics || {};
  for (const [single,plural] of Object.entries({race:'races',gender:'genders',age:'ages',culture:'cultures',wealth:'wealths'})) {
    if (value(single)) { generation.demographics[single]=value(single);delete generation.demographics[plural]; }
    else if (generation.demographics[single]===originalD[single]) delete generation.demographics[single];
  }
  if (value('population')!=='') generation.demographics.population=Number(value('population'));
  else delete generation.demographics.population;
  if (value('seed')) generation.seed=value('seed'); else delete generation.seed;
  generation.revision=Number(value('revision'));
  const selected=fields.filter(f=>data.has('field-'+f));
  // Preserve inheritance until an author changes the set of enabled fields.
  const initial=form.dataset.initialFields;
  if (JSON.stringify(selected)!==initial || original.generation?.fields) generation.fields=selected;
  place.generation=generation;
  place.overrides={};
  for (const field of fields) if (data.has('override-'+field)) place.overrides[field]=value('text-'+field);
  if (!Object.keys(place.overrides).length) delete place.overrides;
  return place;
}
export function typeOptions(map,category) {
  return options(Object.entries(catalogFor(map,{generation:{version:2}}).types).filter(([,v])=>v.category===category).map(([id,v])=>({id,name:v.label})),category);
}

