import { escape, icon, toast } from './ui.js';
import { ancestries } from './generation/settlement-pools-v1.js';
import { settlementTypes } from './generation/economy-settlements.js';
import { normalizeSettings, applySettings } from './generation/settlement-settings.js';
import { materializeMap } from './generation/locations.js';
import { regenerateContent } from './local-maps/regeneration.js';
import { defaultRegenerationMode, regenerationSummary } from './regeneration-summary.js';

function newSeed() {return Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16).padStart(8,'0')).join('');}
export function openRegeneration(viewer) {
  const current=viewer.generationSettings,layout=Boolean(viewer.source.worldImport?.bounds);
  const dialog=document.createElement('dialog');dialog.className='settlement-dialog regeneration-dialog';
  dialog.setAttribute('aria-labelledby','regeneration-title');
  dialog.innerHTML=`<form>
    <header><div><span class="eyebrow">NEW LOCAL VARIATION</span><h2 id="regeneration-title">Regenerate map</h2></div><button type="button" class="icon-button" data-close aria-label="Close regeneration">${icon('close')}</button></header>
    <p>Preview a new variation of ${escape(viewer.source.name)}. Saving creates a separate map on this device. Your current map stays available in the collection.</p>
    <label for="regeneration-mode">What to regenerate</label><select id="regeneration-mode" name="mode" aria-describedby="regeneration-help"><option value="layout" ${layout?'selected':'disabled'}>Rebuild roads, buildings and content</option><option value="content" ${layout?'':'selected'}>Names and stories only (same layout)</option></select>
    <p id="regeneration-help"></p>
    <label for="regeneration-ancestry">Settlement ancestry</label><select id="regeneration-ancestry" name="ancestry"><option value="original" ${current.ancestry==='original'?'selected':''}>As authored</option>${Object.entries(ancestries).map(([key,label])=>`<option value="${key}" ${current.ancestry===key?'selected':''}>${escape(label)}</option>`).join('')}</select>
    <label for="regeneration-settlement">Settlement type</label><select id="regeneration-settlement" name="settlementType"><option value="original">As authored</option>${Object.entries(settlementTypes).map(([key,p])=>`<option value="${key}" ${current.settlementType===key?'selected':''}>${escape(p.label)}</option>`).join('')}</select>
    <label for="regeneration-seed">Generation seed</label><div class="seed-input"><input id="regeneration-seed" name="seed" value="${newSeed()}" required maxlength="128" spellcheck="false" autocomplete="off"><button type="button" class="button" data-seed>${icon('dice')}<span>New seed</span></button></div>
    <button type="button" class="button quiet" data-current>Use current seed</button>
    <section class="regeneration-preview" hidden aria-label="Regenerated map preview"><canvas hidden aria-label="Layout preview"></canvas><div data-summary></div></section>
    <p class="settlement-error" role="status" aria-live="polite"></p>
    <footer><button type="button" class="button" data-close>Cancel</button><button type="button" class="button primary" data-preview>Preview</button><button type="submit" class="button primary" hidden>Save new map</button></footer>
  </form>`;
  document.body.append(dialog);
  const form=dialog.querySelector('form'),status=dialog.querySelector('[role=status]'),preview=dialog.querySelector('.regeneration-preview'),canvas=dialog.querySelector('canvas'),summary=dialog.querySelector('[data-summary]'),save=form.querySelector('[type=submit]');
  form.elements.mode.value=defaultRegenerationMode(viewer.source);
  let result,job,busy=false,saving=false;
  const message=text=>{status.textContent=text;};
  function help() {
    dialog.querySelector('#regeneration-help').textContent=form.elements.mode.value==='layout'
      ? 'Rebuild generated roads, buildings, terrain and districts with the latest planner. Retained real-world geometry is reused offline. Generated sites and their links may change. Mapped tree points are replaced with procedural decoration.'
      : `Regenerate names, residents and stories. The number of roads and buildings stays the same, including when you change settlement type.${layout?' Choose rebuild to grow a village into a city or metropolis.':' Layout regeneration is available for real-world imports with saved bounds.'}`;
  }
  function buttons() {
    form.querySelectorAll('input,select,button').forEach(el=>el.disabled=busy);
    form.querySelectorAll('[data-close]').forEach(el=>{el.disabled=saving;});
    save.hidden=!result;dialog.setAttribute('aria-busy',String(busy));
  }
  function invalidate() {result=null;preview.hidden=true;canvas.hidden=true;save.hidden=true;message('');help();}
  form.addEventListener('input',invalidate);
  form.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-close')&&!saving)dialog.close();
    if(button.hasAttribute('data-seed')){form.elements.seed.value=newSeed();invalidate();}
    if(button.hasAttribute('data-current')){form.elements.seed.value=current.seed;invalidate();}
  });
  form.querySelector('[data-preview]').addEventListener('click',async()=>{
    if(busy||!form.reportValidity())return;
    invalidate();busy=true;job=new AbortController();buttons();message('Regenerating map…');
    try {
      const settings=normalizeSettings(viewer.source,{ancestry:form.elements.ancestry.value,settlementType:form.elements.settlementType.value,seed:form.elements.seed.value});
      let next;
      if(form.elements.mode.value==='layout') {
        const {regenerateInWorker}=await import('./world-maps/worker-client.js');job.signal.throwIfAborted();
        next=await regenerateInWorker(viewer.source,settings,{signal:job.signal,onProgress:message});
        const {renderFantasy}=await import('./world-maps/render.js');job.signal.throwIfAborted();
        await renderFantasy(canvas,next,viewer.source.worldImport.settings,{edge:900,signal:job.signal,districts:true});canvas.hidden=false;
      } else next={map:regenerateContent(viewer.source,settings)};
      job.signal.throwIfAborted();
      const data=materializeMap(applySettings(next.map,settings));
      const names=data.locations.filter(p=>!['water','terrain','street'].includes(p.category)&&!p.overrides?.name).slice(0,4).map(p=>p.name);
      const counts=regenerationSummary(next.map),rebuilding=form.elements.mode.value==='layout';
      summary.innerHTML=`<p>${counts.buildings.toLocaleString()} buildings (${counts.homes.toLocaleString()} homes, ${counts.businesses.toLocaleString()} shops and workshops) · ${counts.roads.toLocaleString()} road segments · ${counts.alleys.toLocaleString()} alleys · ${next.map.districts.length} districts.</p><p>${rebuilding&&counts.target?`Building target: about ${counts.target.toLocaleString()}. `:''}${rebuilding?'Authored overrides stay as written on retained sites.':'Layout unchanged. Settlement type affects stories and occupations only.'}</p><ul>${names.map(name=>`<li>${escape(name)}</li>`).join('')}</ul>${rebuilding?counts.warnings.map(w=>`<p>${escape(w)}</p>`).join(''):''}`;
      result={...next,settings,layout:form.elements.mode.value==='layout'};preview.hidden=false;message('Preview ready. Save to create a separate local map.');
    } catch(error) {if(!job.signal.aborted)message(error.message);}
    finally {busy=false;if(dialog.isConnected)buttons();}
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!result)return;
    busy=true;job=new AbortController();buttons();message('Preparing the new map…');
    try {
      let files;
      if(result.layout) {
        const {imageFiles}=await import('./world-maps/render.js');job.signal.throwIfAborted();
        files=await imageFiles(result,viewer.source.worldImport.settings,job.signal);
      }
      job.signal.throwIfAborted();saving=true;buttons();message('Saving the new map…');
      await viewer.onRegenerate(result.map,result.settings,files,job.signal);
      dialog.close();toast('Regenerated map saved as a new local variation.');
    } catch(error) {if(!job.signal.aborted)message(error.message);}
    finally {busy=false;saving=false;if(dialog.isConnected)buttons();}
  });
  dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
  const dispose=()=>{job?.abort();canvas.width=canvas.height=1;dialog.remove();viewer.signal.removeEventListener('abort',close);};
  const close=()=>{dialog.close();dispose();};
  viewer.signal.addEventListener('abort',close,{once:true});
  dialog.addEventListener('close',()=>{dispose();viewer.root.querySelector('#regenerate-map')?.focus();},{once:true});
  help();dialog.showModal();
}
