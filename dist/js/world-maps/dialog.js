import { readSettlementSetup, suggestSettlementFeatures } from './settlement-setup.js';
import { wizardMarkup } from './wizard-markup.js';
import { sourceGroups, sourceGroup, normalizeSourceSelection, sourceCounts } from './source-selection.js';
import { drawSourceReview, sourceAt } from './source-review.js';
import { planSummary, resultSummary } from './wizard-summary.js';
import { regionPlan, canonicalBounds } from './region-scale.js';
import { regionScaleHTML, updateSourceLabels, outlineExamples } from './region-ui.js';
import { WorldView } from './world-view.js';
import { dimensions, areaInfo, checkRegion } from './geo.js';
import { fetchArea } from './source.js';
import { fetchPreparedArea } from './prepared.js';
import { convertArea } from './model.js';
import { DRAGONSGATE, renderFantasy, imageFiles, downloadBlob } from './render.js';
import { localMapId } from '../local-maps/identity.js';
import { saveLocalMap } from '../local-maps/store.js';
import { exportBackup } from '../local-maps/files.js';
import { escape, toast } from '../ui.js';
export function openWorldImport(onSaved,signal) {
  const dialog=document.createElement('dialog');dialog.className='world-import';dialog.setAttribute('aria-labelledby','world-title');dialog.innerHTML=wizardMarkup();document.body.append(dialog);
  const life=new AbortController(),form=dialog.querySelector('form'),status=dialog.querySelector('.world-status');
  const el=id=>dialog.querySelector('#world-'+id),on=(target,event,fn)=>target.addEventListener(event,fn,{signal:life.signal});
  const canvas=el('fantasy-canvas'),sourceCanvas=el('source-canvas'),mapPanel=dialog.querySelector('.world-map-panel'),art=dialog.querySelector('.world-art'),sourceArt=dialog.querySelector('.world-source-art');
  const plan=dialog.querySelector('.world-plan'),review=dialog.querySelector('.world-review');
  let bounds,result,files,busy=false,job,ticker,cancellable=true,featuresEdited=false,step=0,raw,survey,rawKey='',page=0;
  const excluded=new Set(),pageSize=24;
  const settings=()=>({...DRAGONSGATE,...Object.fromEntries(['paper','water','ink'].map(k=>[k,form.elements[k].value])),...Object.fromEntries(['roadWidth','treeDensity','texture'].map(k=>[k,Number(form.elements[k].value)])),roofDetail:form.elements.roofDetail.checked});
  const outputSize=()=>dimensions(form.elements.format.value,Number(form.elements.edge.value));
  const selectedSource=()=>normalizeSourceSelection({version:2,groups:[...form.querySelectorAll('[name=sourceGroup]:checked')].map(e=>e.value),excluded:[...excluded],buildingUses:form.elements.buildingUses.value});
  const setStatus=text=>{status.querySelector('.world-message').textContent=text;};
  const elapsed=status.querySelector('.world-elapsed');
  const currentKey=()=>JSON.stringify([bounds,form.elements.dataSource.value]);
  function conversionOptions() {
    const [width,height]=outputSize();
    return {regional:true,reinterpret:form.elements.reinterpret.checked,bounds:structuredClone(bounds),width,height,id:localMapId(),name:form.elements.mapName.value.trim(),seed:form.elements.seed.value.trim(),settings:settings()};
  }
  function areaError() {try {checkRegion(bounds);return '';}catch(e){return e.message;}}
  function buttons() {
    form.querySelectorAll('input,select,button').forEach(e=>e.disabled=busy);
    const eligible=bounds&&!areaError()?regionPlan(bounds):null;
    form.querySelectorAll('[name=sourceGroup]').forEach(e=>e.disabled=busy||e.value==='coast'||!eligible?.groups.includes(e.value));
    form.elements.reinterpret.disabled=busy||!eligible?.reinterpret;
    form.elements.dataSource.querySelector('[value=live]').disabled=!eligible?.liveEligible;
    form.elements.secondaryPercent.disabled=busy||!form.elements.secondaryAncestry.value;
    form.elements.districtCount.disabled=busy||form.elements.districtMode.value==='single';
    form.querySelectorAll('[data-source-id]').forEach(e=>e.disabled=busy||!selectedSource().groups.includes(el('feature-group').value));
    dialog.querySelectorAll('[data-world-tab]').forEach(e=>e.disabled=busy||Number(e.dataset.worldTab)>0&&!survey);
    for(const key of ['plus','minus','back','next','generate','download','backup','save'])el(key).disabled=busy;
    el('back').hidden=step===0;el('next').hidden=step===2||busy;el('generate').hidden=step!==2||busy;
    el('next').textContent=step===0?'Read region & continue':'Continue to settlement';
    el('next').disabled=busy||(step===0?Boolean(areaError()):!survey);
    el('generate').textContent=result?'Update fantasy preview':'Create fantasy preview';el('generate').classList.toggle('primary',!result);
    for(const key of ['download','backup','save'])el(key).hidden=step!==2||!result||busy;
    el('cancel').hidden=!busy;el('cancel').disabled=!cancellable;el('preview-districts').disabled=busy;
    el('step-label').textContent=`Step ${step+1} of 3`;
    mapPanel.setAttribute('aria-busy',String(busy));dialog.querySelector('.world-map').inert=busy||step!==0;
    updateListButtons();
  }
  function updateAreaLabel() {
    if(!bounds)return;
    const a=result&&step===2?{width:result.map.width*result.map.measurement.metersPerPixel,height:result.map.height*result.map.measurement.metersPerPixel}:areaInfo(bounds);
    dialog.querySelector('.world-area').textContent=`${result&&step===2?'Fantasy: ':''}${(a.width/1000).toFixed(2)} × ${(a.height/1000).toFixed(2)} km`;
  }
  function showStep(next,focus=true) {
    const changed=step!==next;step=next;dialog.dataset.step=String(step);
    form.querySelectorAll('[data-world-step]').forEach(e=>e.hidden=Number(e.dataset.worldStep)!==step);
    dialog.querySelectorAll('[data-world-tab]').forEach(e=>e.setAttribute('aria-current',Number(e.dataset.worldTab)===step?'step':'false'));
    mapPanel.hidden=step!==0;sourceArt.hidden=step===0||step===2&&Boolean(result);art.hidden=step!==2||!result;
    plan.hidden=step!==2||Boolean(result);review.hidden=step!==2||!result;
    el('view-title').textContent=step===0?'Frame your region':step===1?'Choose source features':result?'Fantasy preview':'Your retained geography';
    if(changed||focus){
      form.scrollTop=0;dialog.querySelector('.world-body').scrollTop=0;
      setStatus(step===0?'Frame your region, then read its features.':step===1?'Choose the geography to keep. Click a feature or use the list to leave it out.':result?'Review the fantasy preview before saving.':'Choose a settlement and the features the system may establish.');
    }buttons();
    updateAreaLabel();if(step===2)updatePlan();
    if(focus)form.querySelector(`[data-world-step="${step}"] h3`).focus();
  }
  function invalidate(clearSurvey=false) {
    result=null;files=null;review.hidden=true;
    if(clearSurvey){raw=null;survey=null;rawKey='';excluded.clear();page=0;}
    if(step>0&&!survey)showStep(0);else showStep(step,false);
  }
  function updateDimensions() {
    const [w,h]=outputSize();dialog.querySelector('.world-dimensions').textContent=`${w.toLocaleString()} × ${h.toLocaleString()} pixels · no modern labels`;
  }
  function updateRegion() {
    const error=areaError();dialog.querySelector('.world-region-summary').textContent=error||`${areaInfo(bounds).km2.toLocaleString(undefined,{maximumFractionDigits:2})} km² selected.`;
    if(!error){
      const p=regionPlan(bounds);dialog.querySelector('.world-scale-summary').innerHTML=regionScaleHTML(p);
      if(!p.liveEligible)form.elements.dataSource.value='prepared';
      dialog.querySelector('.world-source-note').textContent=p.liveEligible?'Prepared data is a March 2026 snapshot. Live data can be newer but public services may be busy.':'Broad regions use prepared data at an appropriate detail level. Only a bounded cutout is downloaded.';
    }buttons();
  }
  function updatePlan() {
    if(!survey)return;
    if(!form.elements.settlementType.value){plan.innerHTML='<strong>Choose a settlement type to see your plan.</strong><p>Your selected geography is shown above. Then choose which sites and rural parcels the system may establish.</p>';return;}
    try {plan.innerHTML=planSummary(survey.map,selectedSource(),readSettlementSetup(form),{reinterpret:form.elements.reinterpret.checked});}catch(e){plan.textContent=e.message;}
  }
  function listPlaces() {return survey?.map.locations.filter(p=>sourceGroup(p)===el('feature-group').value)||[];}
  function updateListButtons() {
    el('list-prev').disabled=busy||page===0;el('list-next').disabled=busy||(page+1)*pageSize>=listPlaces().length;
  }
  function featureList() {
    const focused=document.activeElement?.dataset?.sourceId;
    const places=listPlaces();page=Math.min(page,Math.max(0,Math.ceil(places.length/pageSize)-1));
    const start=page*pageSize,group=el('feature-group').value;
    dialog.querySelector('.world-feature-list').innerHTML=places.slice(start,start+pageSize).map((p,i)=>`<label class="world-checkbox"><input type="checkbox" data-source-id="${escape(p.id)}" ${excluded.has(p.id)?'':'checked'} ${selectedSource().groups.includes(group)?'':'disabled'}><span>${escape(p.worldStyle?.sourceName||`${sourceGroups[group].label} ${start+i+1}`)}<small>${Math.round(p.x/survey.map.width*100)}% from left, ${Math.round(p.y/survey.map.height*100)}% from top</small></span></label>`).join('')||'<p>No features in this group.</p>';
    if(focused)dialog.querySelector(`[data-source-id="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});
    el('list-page').textContent=places.length?`${start+1} to ${Math.min(start+pageSize,places.length)} of ${places.length}`:'0 features';updateListButtons();
  }
  function updateSource() {
    if(!survey)return;
    const selection=selectedSource();updateSourceLabels(form,survey.map,selection,survey.trees);
    drawSourceReview(sourceCanvas,survey.map,selection,survey.trees);featureList();buttons();updatePlan();
  }
  function beginJob(message) {
    busy=true;cancellable=true;job=new AbortController();buttons();setStatus(message);
    const started=Date.now(),tick=()=>{elapsed.textContent=` · ${Math.floor((Date.now()-started)/1000)}s`;};
    elapsed.hidden=false;tick();ticker=setInterval(tick,1000);
  }
  function endJob() {clearInterval(ticker);elapsed.hidden=true;busy=false;if(!life.signal.aborted){buttons();if(survey)featureList();}}
  function downloadProgress(p) {
    if(p.stage==='prepared')setStatus(`Reading region… ${p.completed} of ${p.total} parts · ${Math.ceil(p.bytes/1024).toLocaleString()} KB received.`);
    else if(p.stage==='fallback')setStatus('The first service is slow. Trying another service…');
    else if(p.stage==='receiving')setStatus(`Reading region… ${Math.ceil(p.bytes/1024).toLocaleString()} KB received.`);
    else setStatus('Requesting buildings, roads, water and terrain…');
  }
  async function readRegion() {
    if(busy||areaError())return;
    const key=currentKey(),newRegion=key!==rawKey;beginJob('Reading the selected region…');
    try {
      const data=raw&&rawKey===key?raw:await (form.elements.dataSource.value==='live'?fetchArea:fetchPreparedArea)(structuredClone(bounds),job.signal,{onProgress:downloadProgress,regional:true});
      job.signal.throwIfAborted();life.signal.throwIfAborted();
      const next=convertArea(data,{...conversionOptions(),survey:true});
      raw=data;rawKey=key;survey=next;
      if(newRegion)form.querySelectorAll('[name=sourceGroup]').forEach(e=>e.checked=next.map.worldImport.regionPlan.groups.includes(e.value));result=null;files=null;updateSource();showStep(1);
      setStatus('Region loaded. Choose what to keep. Moving between steps and changing fantasy choices does not download the region again.');
    }catch(e){if(!life.signal.aborted)setStatus(job.signal.aborted?'Reading cancelled. Your region and choices are kept.':`${e.message} Your region is kept. Try again or choose another data source.`);}
    finally {endJob();}
  }
  on(dialog.querySelector('.world-steps'),'click',e=>{const tab=e.target.closest('[data-world-tab]');if(!tab||busy)return;showStep(Number(tab.dataset.worldTab));});
  on(el('back'),'click',()=>{if(!busy)showStep(step-1);});
  on(el('next'),'click',()=>{if(step===0)readRegion();else if(!busy)showStep(2);});
  form.addEventListener('invalid',e=>{const section=e.target.closest('[data-world-step]');if(section){section.closest('details')?.setAttribute('open','');e.target.closest('details')?.setAttribute('open','');showStep(Number(section.dataset.worldStep));}},{capture:true,signal:life.signal});
  const world=new WorldView(dialog.querySelector('.world-map'),(selection,center)=>{
    if(step!==0)return;const b=canonicalBounds(selection);
    if(bounds&&JSON.stringify(bounds)!==JSON.stringify(b)){invalidate(true);setStatus('Frame changed. Read the region when you are ready.');}
    bounds=b;
    if(document.activeElement!==form.elements.latitude&&document.activeElement!==form.elements.longitude){form.elements.longitude.value=center[0].toFixed(5);form.elements.latitude.value=center[1].toFixed(5);}
    updateAreaLabel();updateRegion();
  },life.signal);
  on(el('plus'),'click',()=>world.zoomAt(1));on(el('minus'),'click',()=>world.zoomAt(-1));
  on(el('go'),'click',()=>{
    const lat=Number(form.elements.latitude.value),lon=Number(form.elements.longitude.value);
    if(!form.elements.latitude.value||!form.elements.longitude.value||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>85||Math.abs(lon)>180){setStatus('Enter latitude from −85 to 85 and longitude from −180 to 180.');return;}
    world.go(lon,lat);
  });
  on(form.elements.basemap,'change',()=>{world.setBasemap(form.elements.basemap.value);dialog.querySelector('.world-attribution').innerHTML='© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'+(form.elements.basemap.value==='terrain'?' · <a href="https://opentopomap.org/about" target="_blank" rel="noopener">OpenTopoMap</a>':'');});
  on(form.elements.example,'change',()=>{const value=form.elements.example.value;if(outlineExamples[value])world.fitBounds(outlineExamples[value]);else if(value){const [lon,lat,zoom=16]=value.split(',').map(Number);world.go(lon,lat,zoom);}});
  on(form,'submit',e=>e.preventDefault());
  on(form,'input',e=>{
    const name=e.target.name;
    if(['latitude','longitude','example','basemap'].includes(name)||e.target.id==='world-feature-group'||e.target.dataset.sourceId)return;
    const region=['format','dataSource'].includes(name);invalidate(region);updateDimensions();
    if(name==='format')world.setFormat(form.elements.format.value);
    if(['settlementFeature','settlementLand'].includes(name))featuresEdited=true;
    if(name==='settlementType'&&!featuresEdited)suggestSettlementFeatures(form);
    if(name==='edge'&&raw)survey=convertArea(raw,{...conversionOptions(),survey:true});
    updateSource();updateRegion();
    setStatus(step===0?'Frame the region, then continue.':step===1?'Source choices updated. Missing or deselected layers will be generated.':'Choices updated. Create a fantasy preview to review placement.');
  });
  on(el('suggest-features'),'click',()=>{suggestSettlementFeatures(form);featuresEdited=false;invalidate();updatePlan();setStatus('Settlement suggestions applied. Adjust them or create a preview.');});
  on(el('feature-group'),'change',()=>{page=0;featureList();});
  on(el('list-prev'),'click',()=>{page--;featureList();});on(el('list-next'),'click',()=>{page++;featureList();});
  on(dialog.querySelector('.world-feature-list'),'change',e=>{
    const id=e.target.dataset.sourceId;if(!id)return;e.target.checked?excluded.delete(id):excluded.add(id);invalidate();updateSource();setStatus('Individual feature choice updated.');
  });
  on(sourceCanvas,'click',e=>{
    if(busy||step!==1||!survey)return;const r=sourceCanvas.getBoundingClientRect();
    const p=sourceAt(survey.map,(e.clientX-r.left)/r.width*survey.map.width,(e.clientY-r.top)/r.height*survey.map.height,selectedSource(),6/r.width*survey.map.width);
    if(!p)return;excluded.has(p.id)?excluded.delete(p.id):excluded.add(p.id);invalidate();updateSource();setStatus(`${sourceGroups[sourceGroup(p)].label}: feature ${excluded.has(p.id)?'left out':'restored'}.`);
  });
  on(el('restore'),'click',()=>{excluded.clear();invalidate();updateSource();setStatus('Individual removals restored. Group choices are unchanged.');});
  on(el('reset'),'click',()=>{
    for(const [key,value] of Object.entries(DRAGONSGATE))if(form.elements[key]){if(typeof value==='boolean')form.elements[key].checked=value;else form.elements[key].value=value;}
    invalidate();updatePlan();setStatus('Artwork style restored. Create a new preview.');
  });
  on(el('cancel'),'click',()=>{if(busy&&cancellable){setStatus('Cancelling…');job.abort(new DOMException('Map creation cancelled.','AbortError'));}});
  on(el('generate'),'click',async()=>{
    if(busy||!raw||!survey)return;
    for(const field of form.querySelectorAll('[data-world-step="2"] input,[data-world-step="2"] select'))if(!field.reportValidity())return;
    let settlement;try{settlement=readSettlementSetup(form);}catch(e){setStatus(e.message);return;}
    result=null;files=null;beginJob('Planning districts and placing fantasy sites…');
    try {
      await new Promise(r=>setTimeout(r,0));job.signal.throwIfAborted();
      const next=convertArea(raw,{...conversionOptions(),settlement,sourceSelection:selectedSource()});
      await renderFantasy(canvas,next,settings(),{edge:1000,signal:job.signal,districts:el('preview-districts').checked});job.signal.throwIfAborted();life.signal.throwIfAborted();
      result=next;review.innerHTML=resultSummary(result.map);showStep(2,false);review.scrollTop=0;
      el('view-title').tabIndex=-1;el('view-title').focus();
      if(matchMedia('(max-width:760px)').matches)dialog.querySelector('.world-workspace').scrollIntoView({block:'start'});
      setStatus(result.map.worldImport.planning.warnings.length?'Preview ready. Review the placement notes before saving.':'Preview ready. Review the map, then save it or download a backup.');
    }catch(e){if(!life.signal.aborted){result=null;showStep(2,false);setStatus(job.signal.aborted?'Preview cancelled. Your choices are kept.':e.message);}}
    finally {endJob();}
  });
  async function finish(action) {
    if(!result||busy)return;beginJob('Rendering the full-resolution image…');
    try {
      files ||= await imageFiles(result,settings(),job.signal);job.signal.throwIfAborted();life.signal.throwIfAborted();cancellable=false;buttons();
      const record={map:result.map,...files};
      if(action==='download'){downloadBlob(files.image,`${result.map.id}.png`);setStatus(`Downloaded ${result.map.width} × ${result.map.height} PNG. Download an atlas backup to keep the editable features too.`);}
      if(action==='backup'){await exportBackup(record);setStatus('Atlas backup downloaded with artwork, exact features and your choices.');}
      if(action==='save'){await saveLocalMap(result.map,files.image,files.thumbnail,result.map,{create:true});life.signal.throwIfAborted();const id=result.map.id;dialog.close();toast('Map saved on this device.');onSaved(id);}
    }catch(e){if(!life.signal.aborted)setStatus(job.signal.aborted?'Cancelled. Your preview and choices are kept.':e.message);}finally{endJob();}
  }
  on(el('preview-districts'),'change',async()=>{
    if(!result||busy)return;beginJob('Updating district overlay…');
    try{await renderFantasy(canvas,result,settings(),{edge:1000,signal:job.signal,districts:el('preview-districts').checked});setStatus('District overlay updated. The exported artwork omits boundary colors.');}
    catch(e){if(!life.signal.aborted)setStatus(e.message);}finally{endJob();}
  });
  on(el('download'),'click',()=>finish('download'));on(el('backup'),'click',()=>finish('backup'));on(el('save'),'click',()=>finish('save'));
  const close=()=>dialog.close();on(el('close'),'click',close);
  on(dialog,'click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
  on(dialog,'close',()=>{job?.abort();clearInterval(ticker);life.abort();dialog.remove();signal?.removeEventListener('abort',close);});
  signal?.addEventListener('abort',close,{once:true});updateDimensions();dialog.showModal();showStep(0,false);
}
