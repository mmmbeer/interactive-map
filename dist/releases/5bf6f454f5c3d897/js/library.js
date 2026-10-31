import { brand, escape, icon, loadJSON, number, toast } from './ui.js';
import { materializeMap } from './generation/locations.js';
import { validateMap } from './map-contract.js';
import { MapStage } from './map-stage.js';
import { tooltipHTML } from './places.js';

import { openMapUpload } from './local-maps/upload.js';
import { readLocalMap, hydrateLocalMap } from './local-maps/store.js';

export function renderLibrary(root, maps, signal) {
  let stage, selected = maps[0], previewVersion = 0;
  let previewController,previewURLs=[];
  root.innerHTML = `<div class="library-shell">
    <header class="site-header">${brand()}<nav aria-label="Main navigation"><a class="current" href="#collection"><span class="nav-dot"></span>Maps <span class="nav-count">${String(maps.length).padStart(2,'0')}</span></a><button class="button quiet" id="guide-toggle" aria-label="Quick guide" aria-expanded="false" aria-controls="field-guide">${icon('info')}<span>Quick guide</span></button></nav></header>
    <main class="library-workspace" id="main-content">
      <section class="library-panel" id="collection" aria-labelledby="collection-title">
        <button class="button primary upload-map-button" id="upload-map">${icon('plus')} Upload map</button><div class="library-heading"><span class="eyebrow">THE COLLECTION</span><h1 id="collection-title">Find your<br> next <span>somewhere.</span></h1><p>Choose a map. Get to know every corner.</p></div>
        <label class="search-field">${icon('search')}<input type="search" id="map-search" placeholder="Find a world…" aria-label="Search maps"></label>
        <div class="library-list" role="group" aria-label="Choose a map">${maps.map((m,i)=>`<button class="library-map ${i===0?'active':''}" data-map="${escape(m.id)}" aria-pressed="${i===0}"><span class="map-index">${String(i+1).padStart(2,'0')}</span><img src="${escape(m.thumbnail)}" alt=""><span class="library-map-copy"><strong>${escape(m.name)}</strong><span>${escape(m.theme)} · ${number(m.locationCount)} places</span></span>${icon('arrow')}</button>`).join('')}</div>
        <p class="no-maps" role="status" hidden>No maps match your search.</p>
        <div class="library-summary"><span class="status-dot"></span><span>${number(maps.reduce((sum,m)=>sum+m.locationCount,0))} places to explore</span>${icon('compass')}</div>
        <div class="field-guide" id="field-guide" hidden><h2>A few controls.</h2><p>${icon('compass')} Drag to pan. Scroll or pinch to zoom.</p><p>${icon('eye')} Hover for a preview. Tap to read a story.</p><p>${icon('search')} Search places inside the explorer.</p></div>
      </section>
      <section class="library-preview map-area" aria-label="Interactive map preview">
        <div class="preview-stage map-stage" id="preview-stage" role="region" tabindex="0" aria-label="Map preview. Drag to pan. Scroll or pinch to zoom. Arrow keys pan. Plus and minus zoom. Zero fits the map."></div>
        <div class="preview-topline"><span class="preview-label">${icon('layers')} MAP PREVIEW</span><span class="preview-coordinates" id="preview-region"></span></div>
        <div class="preview-caption"><div><span class="eyebrow" id="preview-theme"></span><h2 id="preview-name"></h2><p id="preview-subtitle"></p></div><a class="button primary" id="explore-map">Explore map ${icon('arrow')}</a></div>
        <div class="preview-navigation"><button class="map-control" id="preview-zoom-in" aria-label="Zoom preview in">${icon('plus')}</button><button class="map-control" id="preview-zoom-out" aria-label="Zoom preview out">${icon('minus')}</button><button class="map-control" id="preview-fit" aria-label="Fit preview map">${icon('fit')}</button></div>
        <div class="preview-help">DRAG TO PAN <span>·</span> SCROLL TO ZOOM</div>
      </section>
    </main>
    <footer class="site-footer"><span>THE WANDERING ATLAS</span><span>Imagined worlds. One place at a time.</span><span class="footer-key">${icon('pin')} Static maps. Stories worth finding.</span></footer>
    <div class="map-tooltip" id="preview-tooltip" role="tooltip" hidden></div>
  </div>`;
  const tooltip = root.querySelector('#preview-tooltip');
  const on = (el,type,callback) => el.addEventListener(type,callback,{signal});
  async function choose(map) {
    selected = map;
    const version = ++previewVersion;
    previewController?.abort();
    previewURLs.forEach(url=>URL.revokeObjectURL(url));previewURLs=[];
    stage?.destroy(); stage = null;
    previewController = new AbortController();
    tooltip.hidden = true;
    root.querySelectorAll('[data-map]').forEach(el => {
      const active = el.dataset.map === map.id;
      el.classList.toggle('active',active);el.setAttribute('aria-pressed',active);
    });
    for (const [id,value] of Object.entries({'preview-region':map.region,'preview-theme':map.theme,'preview-name':map.name,'preview-subtitle':map.subtitle})) root.querySelector('#'+id).textContent = value;
    root.querySelector('#explore-map').href = `#map/${map.id}`;
    const el = root.querySelector('#preview-stage');
    el.innerHTML = `<div class="loading-screen">${icon('compass')}<p>Opening map…</p></div>`;
    try {
      const record=map.local ? await readLocalMap(map.id) : null;
      if(signal.aborted || version!==previewVersion)return;
      const source = map.local ? record?.map : await loadJSON(map.data,previewController.signal);
      validateMap(source);
      const data = materializeMap(record ? hydrateLocalMap(source,record,previewURLs) : source);
      if(signal.aborted || version!==previewVersion)return;
      stage = new MapStage(el,data,{
        select:p=>{ location.hash=`map/${data.id}/${p.id}`; },
        hover:(p,e)=>{
          tooltip.hidden=!p;
          if(!p)return;
          if(tooltip.dataset.place!==p.id){tooltip.innerHTML=tooltipHTML(p);tooltip.dataset.place=p.id;}
          tooltip.style.left=`${Math.max(8,Math.min(innerWidth-tooltip.offsetWidth-12,e.clientX+18))}px`;
          tooltip.style.top=`${Math.max(8,Math.min(innerHeight-tooltip.offsetHeight-12,e.clientY+18))}px`;
        }
      },previewController.signal);
    } catch(error) {
      if(error.name==='AbortError' || signal.aborted || version!==previewVersion)return;
      el.innerHTML='<div class="loading-screen"><p>Preview unavailable. Open the map to try again.</p></div>';
      toast('The map preview could not load.');
    }
  }
  on(root,'click',e=>{
    const button=e.target.closest('button');if(!button)return;
    if(button.id==='upload-map')openMapUpload(id=>{location.hash=`map/${id}`;},signal);
    if(button.dataset.map)choose(maps.find(m=>m.id===button.dataset.map));
    if(button.id==='guide-toggle'){
      const guide=root.querySelector('#field-guide');guide.hidden=!guide.hidden;
      button.setAttribute('aria-expanded',String(!guide.hidden));
    }
    if(button.id==='preview-zoom-in')stage?.zoom(1.4,undefined,true);
    if(button.id==='preview-zoom-out')stage?.zoom(1/1.4,undefined,true);
    if(button.id==='preview-fit')stage?.fit();
  });
  on(root.querySelector('#map-search'),'input',e=>{
    const query=e.target.value.trim().toLowerCase();
    let count=0;
    root.querySelectorAll('[data-map]').forEach(el=>{
      const map=maps.find(m=>m.id===el.dataset.map);
      el.hidden=![map.name,map.region,map.theme,...(map.tags||[])].join(' ').toLowerCase().includes(query);
      if(!el.hidden)count++;
    });
    root.querySelector('.no-maps').hidden=Boolean(count);
  });
  signal.addEventListener('abort',()=>{previewController?.abort();stage?.destroy();previewURLs.forEach(url=>URL.revokeObjectURL(url));},{once:true});
  choose(selected);
  window.scrollTo(0,0);
}
