import { escape, toast } from '../ui.js';
import { validateMap } from '../map-contract.js';
import { resolveLocation } from '../generation/locations.js';
import { configFor, availableFields } from '../generation/config.js';
import { detailHTML } from '../places.js';
import { placeForm, readPlace, typeOptions } from './forms.js';
import { migrateMap, newLocation, saveLocation } from './model.js';
import { writeDraft, clearDraft, downloadMap } from './drafts.js';

export function openEditor(viewer,selected=null) {
  const source=migrateMap(viewer.source),published=viewer.published;
  let original=structuredClone(selected ? source.locations.find(p=>p.id===selected.id) : newLocation(source));
  const originalId=selected?.id ?? null;
  const dialog=document.createElement('dialog');dialog.className='location-editor';
  dialog.innerHTML=`<header><div><span class="eyebrow">MAP AUTHORING</span><h2>${selected?'Edit location':'Add location'}</h2></div><button type="button" class="icon-button editor-close" aria-label="Close editor">×</button></header>
    <p class="editor-notice">${viewer.localMap ? 'Changes save to your local map. Export an atlas backup to include its image and geometry.' : 'Save a draft on this device. Export the map JSON and commit it to publish changes.'}</p>
    <nav class="editor-tabs" aria-label="Editor section"><button type="button" data-tab="place" aria-pressed="true">Location</button><button type="button" data-tab="settings" aria-pressed="false">Map & district defaults</button></nav>
    <div class="editor-body"><section class="editor-form-pane"><form id="location-form"></form><section id="generator-settings" hidden></section></section><aside class="editor-preview"><div class="eyebrow">LIVE PREVIEW</div><div id="generated-preview"></div></aside></div>
    <p class="editor-error" role="status" aria-live="polite"></p><footer><button class="button" type="button" id="editor-pick">Place on map</button>${selected&&viewer.localMap?'<button class="button" type="button" id="editor-delete-place">Delete location</button>':''}<button class="button" type="button" id="editor-vary">New variation</button><button class="button primary" type="button" id="editor-save">Save location</button></footer>
    <details class="editor-files"><summary>Map files & drafts</summary><p>Imports replace this map’s local draft after validation. Export current edits to include unsaved form changes. Export before restoring to keep your work.</p><div><button class="button" id="editor-export">Export saved map JSON</button><button class="button" id="export-current">Export current edits</button>${viewer.staleDraft?'<button class="button" id="export-older-draft">Export older draft</button>':''}<label class="button">Import map JSON<input type="file" accept=".json,application/json" id="editor-import" hidden></label><button class="button" id="editor-restore">${viewer.localMap?'Restore imported geometry':'Restore published map'}</button>${viewer.localMap?'<button class="button" id="local-backup">Export atlas backup</button><button class="button" id="local-delete">Delete local map</button>':''}</div><label><input type="checkbox" id="confirm-restore">Discard saved edits when restoring or deleting</label></details>`;
  document.body.append(dialog);
  const controller=new AbortController();
  const on=(target,event,callback)=>target.addEventListener(event,callback,{signal:controller.signal});
  const form=dialog.querySelector('form'),error=dialog.querySelector('.editor-error'),preview=dialog.querySelector('#generated-preview');
  let timer,picking=false,tab='place';
  const fail=e=>{error.textContent=e.message;};
  const setForm=()=>{
    form.innerHTML=placeForm(source,original,!selected);
    form.dataset.availableFields=JSON.stringify(availableFields(source));
    form.dataset.initialFields=JSON.stringify(original.generation?.fields || configFor(source,original).config.fields);
  };
  const candidate=(previewOnly=false)=>{
    if (!(previewOnly ? form.checkValidity() : form.reportValidity())) throw new Error('Complete the required fields.');
    const p=readPlace(form,original),map=saveLocation(source,p,originalId);
    validateMap(map);return {p,map};
  };
  const showPreview=()=>{
    try {
      const {p,map}=candidate(true),resolved=resolveLocation(map,p);
      preview.innerHTML=detailHTML(resolved);error.textContent='';
      // Preview has no navigation actions.
      preview.querySelectorAll('button').forEach(el=>el.remove());
    } catch(e) { fail(e); }
  };
  const finish=async(map,message,placeId)=>{
    if(viewer.onSave)await viewer.onSave(map);else writeDraft(map,published);
    if(viewer.signal.aborted)return;
    dialog.close();viewer.onChange(map,placeId);toast(message);
  };
  setForm();
  const settings=dialog.querySelector('#generator-settings');
  const settingsData={generator:source.generator,regions:source.regions || [],districts:source.districts};
  settings.innerHTML=`<h3>Inherited generation settings</h3><p>Map defaults → region → district → location. Weights are relative: human: 3 and elf: 1 means 75% human and 25% elf. Choose fields, traits, custom name pools, location types and template tables here.</p><p>Use tokens such as {first}, {district}, {service}, {raceLabel} and {traits} in output templates. See docs/generation.md for the full format.</p><label>Generator, regions and districts (JSON)<textarea id="settings-json" rows="23" spellcheck="false">${escape(JSON.stringify(settingsData,null,2))}</textarea></label><button type="button" class="button" id="apply-settings">Apply defaults to preview</button>`;
  on(dialog,'click',async e=>{
    const button=e.target.closest('button');if(!button)return;
    try {
      if(button.classList.contains('editor-close')) dialog.close();
      if(button.dataset.tab) {
        tab=button.dataset.tab;form.hidden=tab!=='place';settings.hidden=tab!=='settings';
        dialog.querySelectorAll('[data-tab]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.tab===tab)));
        dialog.querySelector('#editor-pick').hidden=tab!=='place';dialog.querySelector('#editor-vary').hidden=tab!=='place';
        dialog.querySelector('#editor-save').textContent=tab==='place'?'Save location':'Save defaults';
      }
      if(button.id==='apply-settings') applySettings();
      if(button.id==='editor-save') {
        if(tab==='settings') {applySettings();await finish(source,'Map defaults saved on this device.');}
        else { const {p,map}=candidate();await finish(map,'Location saved on this device.',p.id); }
      }
      if(button.id==='editor-delete-place') {
        const map=structuredClone(source);map.locations=map.locations.filter(p=>p.id!==originalId);
        for(const p of map.locations)for(const [key,id] of Object.entries(p.context||{}))if(id===originalId)delete p.context[key];
        validateMap(map);await finish(map,'Location deleted on this device.');
      }
      if(button.id==='editor-vary') {form.elements.revision.value=Number(form.elements.revision.value)+1;showPreview();}
      if(button.id==='editor-pick') {
        original=candidate(true).p;picking=true;dialog.close();
        viewer.root.classList.add('placing-location');
        toast('Click or tap the map to place the location. Press Escape to cancel.');
        viewer.stage.callbacks.point=point=>{
          if (point.x<0 || point.y<0 || point.x>source.width || point.y>source.height) return true;
          const dx=Math.round(point.x*10)/10-original.x,dy=Math.round(point.y*10)/10-original.y;
          original.x+=dx;original.y+=dy;
          if(original.bounds) {original.bounds[0]+=dx;original.bounds[1]+=dy;}
          if(original.shape?.points) original.shape.points=original.shape.points.map(([x,y])=>[x+dx,y+dy]);
          if(original.shape?.holes) original.shape.holes=original.shape.holes.map(ring=>ring.map(([x,y])=>[x+dx,y+dy]));
          resume();setForm();showPreview();return true;
        };
      }
      if(button.id==='export-older-draft') downloadMap(viewer.staleDraft);
      if(button.id==='editor-export') downloadMap(migrateMap(viewer.source));
      if(button.id==='export-current') {
        if(tab==='settings') {applySettings();downloadMap(source);}
        else downloadMap(candidate().map);
      }
      if(button.id==='local-backup')await viewer.onBackup();
      if(button.id==='local-delete') {
        if(!dialog.querySelector('#confirm-restore').checked)throw new Error('Select the discard checkbox before deleting this map.');
        await viewer.onDelete();dialog.close();
      }
      if(button.id==='editor-restore') {
        if(!dialog.querySelector('#confirm-restore').checked) throw new Error('Select the discard checkbox before restoring.');
        if(viewer.onRestore){const map=await viewer.onRestore();dialog.close();viewer.onChange(map);toast('Imported geometry restored.');}
        else {clearDraft(published.id);dialog.close();viewer.onChange(published);toast('Published map restored.');}
      }
    } catch(e) {fail(e);}
  });
  function applySettings() {
    const data=JSON.parse(settings.querySelector('textarea').value);
    if (!data || !data.generator || !Array.isArray(data.districts) || !Array.isArray(data.regions)) throw new Error('Provide generator, regions and districts.');
    const map={...source,generator:data.generator,regions:data.regions,districts:data.districts};
    validateMap(map);
    original=readPlace(form,original);
    Object.assign(source,map);setForm();showPreview();
    error.textContent='Defaults applied to preview. Save defaults to keep them.';
  }
  function resume() {
    picking=false;viewer.stage.callbacks.point=null;viewer.root.classList.remove('placing-location');dialog.showModal();
  }
  on(viewer.root,'keydown',e=>{
    if(picking && e.key==='Escape') {e.preventDefault();resume();}
  });
  on(form,'input',()=>{clearTimeout(timer);timer=setTimeout(showPreview,200);});
  on(form,'change',e=>{
    if(e.target.name==='category') {
      form.elements.type.innerHTML=typeOptions(source,e.target.value);
      if (['street','water','terrain'].includes(e.target.value)) form.elements.version.value='2';
    }
    if(e.target.name==='shape') {
      form.querySelector('[data-polygon-holes]').hidden=e.target.value!=='polygon';
      form.elements.holes.value='[]';
      form.querySelector('[data-route-width]').hidden=e.target.value!=='polyline';
      const x=Number(form.elements.x.value),y=Number(form.elements.y.value);
      form.elements.geometry.value=JSON.stringify(e.target.value==='ellipse' ? [5,5] : e.target.value==='polyline' ? [[x-5,y],[x+5,y]] : e.target.value==='polygon' ? [[x-5,y-5],[x+5,y-5],[x,y+5]] : [x-5,y-5,10,10]);
    }
    showPreview();
  });
  on(form,'submit',e=>{e.preventDefault();dialog.querySelector('#editor-save').click();});
  on(dialog.querySelector('#editor-import'),'change',async e=>{
    try {
      const file=e.target.files[0];if(!file)return;
      if(file.size>10*1024*1024) throw new Error('Map JSON must be under 10 MB.');
      const map=migrateMap(JSON.parse(await file.text()));
      if(viewer.signal.aborted)return;
      validateMap(map);
      if(map.id!==source.id) throw new Error('Import a file with this map’s id. Use Upload map in the collection to add another map.');
      await finish(map,'Imported map saved as a local draft.');
    } catch(e) {fail(e);}
  });
  on(dialog,'close',()=>{
    if(!picking) {dispose();viewer.root.querySelector('#edit-map')?.focus();}
  });
  function dispose() {
    clearTimeout(timer);controller.abort();dialog.remove();
    if(picking) {viewer.stage.callbacks.point=null;viewer.root.classList.remove('placing-location');}
    viewer.signal.removeEventListener('abort',dispose);
  }
  viewer.signal.addEventListener('abort',dispose,{once:true});
  dialog.showModal();showPreview();
}

