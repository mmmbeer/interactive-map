import { WorldView } from './world-view.js';
import { dimensions, areaInfo, checkArea } from './geo.js';
import { fetchArea } from './source.js';
import { convertArea } from './model.js';
import { DRAGONSGATE, renderFantasy, imageFiles, downloadBlob } from './render.js';
import { localMapId } from '../local-maps/identity.js';
import { saveLocalMap } from '../local-maps/store.js';
import { exportBackup } from '../local-maps/files.js';
import { toast } from '../ui.js';
export function openWorldImport(onSaved,signal) {
  const dialog=document.createElement('dialog');dialog.className='world-import';dialog.setAttribute('aria-labelledby','world-title');
  dialog.innerHTML=`<header class="world-header"><div><span class="eyebrow">FROM THE WORLD TO YOUR ATLAS</span><h2 id="world-title">Create from a real place</h2></div><button class="icon-button" type="button" id="world-close" aria-label="Close world map">×</button></header>
    <div class="world-body"><form class="world-settings">
      <label>Map name<input name="mapName" value="My new settlement" maxlength="100" required></label>
      <fieldset><legend>Image shape</legend><div class="world-shapes"><label><input type="radio" name="format" value="square" checked><span>□ Square</span></label><label><input type="radio" name="format" value="landscape"><span>▭ Landscape</span></label><label><input type="radio" name="format" value="portrait"><span>▯ Portrait</span></label></div></fieldset>
      <label>Image resolution<select name="edge"><option value="2048">2048 px · smaller file</option><option value="4096" selected>4096 px · high resolution</option><option value="4800">4800 px · maximum detail</option></select></label>
      <p class="world-dimensions"></p>
      <fieldset><legend>Find your area</legend><label>Navigation map<select name="basemap"><option value="terrain">OpenTopoMap terrain</option><option value="street">OpenStreetMap streets</option></select></label><label>Jump to an example<select name="example"><option value="">Choose a place…</option><option value="-3.191,55.950">Edinburgh · Old Town</option><option value="12.335,45.435">Venice · canals</option><option value="-89.384,43.074">Madison · Capitol</option><option value="0,20">World view</option></select></label>
      <div class="world-coordinates"><label>Latitude<input name="latitude" type="number" min="-85" max="85" step="any" value="20"></label><label>Longitude<input name="longitude" type="number" min="-180" max="180" step="any" value="0"></label></div><button type="button" class="button" id="world-go">Go to coordinates</button></fieldset>
      <details open><summary>Dragonsgate style</summary><p>Black ink buildings, pale land, muted water and fine tree outlines. Source labels are omitted.</p>
      <div class="world-colors"><label>Land<input type="color" name="paper" value="${DRAGONSGATE.paper}"></label><label>Water<input type="color" name="water" value="${DRAGONSGATE.water}"></label><label>Ink<input type="color" name="ink" value="${DRAGONSGATE.ink}"></label></div>
      <label>Road width<input type="range" name="roadWidth" min="0.6" max="1.8" step="0.1" value="1"></label>
      <label>Woodland tree density<input type="range" name="treeDensity" min="0" max="2" step="0.25" value="1"></label>
      <label>Paper texture<input type="range" name="texture" min="0" max="1" step="0.05" value="0.35"></label>
      <label class="world-checkbox"><input type="checkbox" name="roofDetail"> Add roof detail</label><button class="button quiet" type="button" id="world-reset">Reset style</button></details>
      <details><summary>Generation and source</summary><label>Generation seed<input name="seed" value="world-map-v1" maxlength="128" required></label><p>Building uses and stories are fictional. Roads and footprints follow available map data. Vegetation coverage varies. Districts can be traced after import.</p><p>Geometry is fetched through <a href="https://overpass.private.coffee/" target="_blank" rel="noopener">Overpass by Private.coffee</a>. Your selection bounds are sent to that service.</p><p>Maps save on this device. Download an atlas backup to keep artwork and geometry together.</p><p>Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>, ODbL. Public map services may be busy. Select an area under 36 km².</p></details>
    </form><section class="world-workspace" aria-label="Map selection and preview">
      <div class="world-view-tabs"><button class="button quiet" id="world-show-map" aria-pressed="true">World map</button><button class="button quiet" id="world-show-art" aria-pressed="false" disabled>Fantasy preview</button><span class="world-area"></span></div>
      <div class="world-map-panel"><div class="world-map" tabindex="0" role="region" aria-label="World map. Drag to pan, scroll or pinch to zoom. Arrow keys pan. Plus and minus zoom."></div><div class="world-navigation"><button class="map-control" id="world-plus" aria-label="Zoom world map in">+</button><button class="map-control" id="world-minus" aria-label="Zoom world map out">−</button></div><div class="world-attribution">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>, SRTM · © <a href="https://opentopomap.org/about" target="_blank" rel="noopener">OpenTopoMap (CC-BY-SA)</a></div><p class="world-pan-help">Drag the world beneath the frame. Scroll or pinch to zoom.</p></div>
      <div class="world-art" hidden><canvas aria-label="Fantasy map preview"></canvas><p>Image and selectable features share the same geometry. Review missing features after import.</p></div>
      <p class="world-status" role="status" aria-live="polite">Zoom in or jump to an example to select a settlement.</p>
    </section></div>
    <footer class="world-footer"><button type="button" class="button" id="world-generate">Create preview</button><button type="button" class="button" id="world-download" disabled>Download PNG</button><button type="button" class="button" id="world-backup" disabled>Download atlas backup</button><button type="button" class="button primary" id="world-save" disabled>Save and open map</button></footer>`;
  document.body.append(dialog);
  const life=new AbortController(),form=dialog.querySelector('form'),status=dialog.querySelector('.world-status'),canvas=dialog.querySelector('canvas'),mapPanel=dialog.querySelector('.world-map-panel'),art=dialog.querySelector('.world-art');
  const el=id=>dialog.querySelector('#world-'+id),on=(target,event,fn)=>target.addEventListener(event,fn,{signal:life.signal});
  let bounds,result,files,busy=false,job;
  const settings=()=>({...DRAGONSGATE,...Object.fromEntries(['paper','water','ink'].map(k=>[k,form.elements[k].value])),...Object.fromEntries(['roadWidth','treeDensity','texture'].map(k=>[k,Number(form.elements[k].value)])),roofDetail:form.elements.roofDetail.checked});
  const format=()=>form.elements.format.value;
  const outputSize=()=>dimensions(format(),Number(form.elements.edge.value));
  const setStatus=text=>{status.textContent=text;};
  function showArt(value) {if(value)dialog.querySelector('.world-body').scrollTop=0;mapPanel.hidden=value;art.hidden=!value;el('show-map').setAttribute('aria-pressed',String(!value));el('show-art').setAttribute('aria-pressed',String(value));}
  function buttons() {
    for(const key of ['save','download','backup','show-art'])el(key).disabled=busy||!result;
    el('generate').disabled=busy;el('generate').textContent=busy?'Creating map…':'Create preview';
    form.querySelectorAll('input,select,button').forEach(e=>e.disabled=busy);dialog.querySelector('.world-map').inert=busy;
    for(const key of ['plus','minus','show-map'])el(key).disabled=busy;
  }
  function invalidate() {if(busy)return;result=null;files=null;buttons();showArt(false);}
  function updateDimensions() {const [w,h]=outputSize();dialog.querySelector('.world-dimensions').textContent=`${w.toLocaleString()} × ${h.toLocaleString()} pixels · labels removed` ;}
  const world=new WorldView(dialog.querySelector('.world-map'),(b,center)=>{
    if(bounds&&JSON.stringify(bounds)!==JSON.stringify(b)){invalidate();setStatus('Selection changed. Create a new preview.');}
    bounds=b;
    if(document.activeElement!==form.elements.latitude&&document.activeElement!==form.elements.longitude){form.elements.longitude.value=center[0].toFixed(5);form.elements.latitude.value=center[1].toFixed(5);}
    const area=areaInfo(b);dialog.querySelector('.world-area').textContent=`${(area.width/1000).toFixed(2)} × ${(area.height/1000).toFixed(2)} km`;
  },life.signal);
  on(el('plus'),'click',()=>world.zoomAt(1));on(el('minus'),'click',()=>world.zoomAt(-1));
  on(el('go'),'click',()=>{
    const lat=Number(form.elements.latitude.value),lon=Number(form.elements.longitude.value);
    if(!form.elements.latitude.value||!form.elements.longitude.value||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>85||Math.abs(lon)>180){setStatus('Enter a latitude from −85 to 85 and longitude from −180 to 180.');return;}
    showArt(false);world.go(lon,lat);
  });
  on(form.elements.basemap,'change',()=>{world.setBasemap(form.elements.basemap.value);dialog.querySelector('.world-attribution').innerHTML=form.elements.basemap.value==='terrain'?'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>, SRTM · © <a href="https://opentopomap.org/about" target="_blank" rel="noopener">OpenTopoMap (CC-BY-SA)</a>':'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>';});
  on(form.elements.example,'change',()=>{if(!form.elements.example.value)return;const [lon,lat]=form.elements.example.value.split(',').map(Number);showArt(false);world.go(lon,lat,form.elements.example.value==='0,20'?2:16);});
  on(form,'submit',e=>e.preventDefault());
  on(form,'input',e=>{
    if(['latitude','longitude','example','basemap'].includes(e.target.name))return;
    invalidate();updateDimensions();if(e.target.name==='format')world.setFormat(format());
    setStatus('Settings changed. Create a new preview.');
  });
  on(el('reset'),'click',()=>{
    for(const [key,value] of Object.entries(DRAGONSGATE))if(form.elements[key]){if(typeof value==='boolean')form.elements[key].checked=value;else form.elements[key].value=value;}
    invalidate();setStatus('Dragonsgate style restored. Create a new preview.');
  });
  on(el('show-map'),'click',()=>showArt(false));on(el('show-art'),'click',()=>showArt(true));
  on(el('generate'),'click',async()=>{
    if(busy)return;
    try {
      if(!form.reportValidity())return;checkArea(bounds);
      busy=true;result=null;files=null;buttons();job=new AbortController();setStatus('Downloading roads, buildings, water and land…');
      const selection=structuredClone(bounds),data=await fetchArea(selection,job.signal);life.signal.throwIfAborted();
      setStatus('Drawing the fantasy map…');await new Promise(r=>setTimeout(r,0));
      const [width,height]=outputSize(),next=convertArea(data,{bounds:selection,width,height,id:localMapId(),name:form.elements.mapName.value.trim(),seed:form.elements.seed.value.trim(),settings:settings()});
      await renderFantasy(canvas,next,settings(),{edge:1400,signal:job.signal});life.signal.throwIfAborted();result=next;showArt(true);
      const count=category=>result.map.locations.filter(p=>p.category===category).length;
      setStatus(`${count('home').toLocaleString()} buildings · ${count('street').toLocaleString()} road sections · ${count('water')} water feature${count('water')===1?'':'s'} · ${count('terrain')} land area${count('terrain')===1?'':'s'}. Ready to download or save.`);
    } catch(e){if(!life.signal.aborted){result=null;setStatus(e.message);}}
    finally {busy=false;if(!life.signal.aborted)buttons();}
  });
  async function finish(action) {
    if(!result||busy)return;
    busy=true;buttons();job=new AbortController();setStatus('Rendering the full-resolution image…');
    try {
      files ||= await imageFiles(result,settings(),job.signal);life.signal.throwIfAborted();
      const record={map:result.map,...files};
      if(action==='download'){downloadBlob(files.image,`${result.map.id}.png`);setStatus(`Downloaded ${result.map.width} × ${result.map.height} PNG. An atlas backup also preserves every selectable feature.`);}
      if(action==='backup'){await exportBackup(record);setStatus('Atlas backup downloaded with the image and exact feature geometry.');}
      if(action==='save'){
        await saveLocalMap(result.map,files.image,files.thumbnail,result.map,{create:true});life.signal.throwIfAborted();const id=result.map.id;dialog.close();toast('Map saved on this device.');onSaved(id);
      }
    }catch(e){if(!life.signal.aborted)setStatus(e.message);}finally{busy=false;if(!life.signal.aborted)buttons();}
  }
  on(el('download'),'click',()=>finish('download'));on(el('backup'),'click',()=>finish('backup'));on(el('save'),'click',()=>finish('save'));
  const close=()=>dialog.close();on(el('close'),'click',close);
  on(dialog,'click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
  on(dialog,'close',()=>{job?.abort();life.abort();dialog.remove();signal?.removeEventListener('abort',close);});
  signal?.addEventListener('abort',close,{once:true});updateDimensions();dialog.showModal();
}
