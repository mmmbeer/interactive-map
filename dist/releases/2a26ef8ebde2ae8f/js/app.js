import { escape, icon, loadJSON } from './ui.js';
import { renderLibrary } from './library.js';
import { readDraft } from './authoring/drafts.js';
import { materializeMap } from './generation/locations.js';
import { validateMap } from './map-contract.js';
import { AtlasViewer } from './viewer.js';
import { applySettings, readSettings, saveSettings, settingsURL } from './generation/settlement-settings.js';
import { listLocalMaps, readLocalMap, hydrateLocalMap, saveLocalMap, deleteLocalMap } from './local-maps/store.js';
import { saveVariation } from './local-maps/variations.js';
import { numberSites } from './site-index.js';
import { exportBackup } from './local-maps/files.js';
const root = document.querySelector('#app');
let viewer, maps, loadController, routeVersion = 0;
let localURLs=[];
async function route() {
  const version = ++routeVersion;
  loadController?.abort();
  loadController = new AbortController();
  const signal = loadController.signal;
  const [, mapId, placeId] = location.hash.match(/^#map\/([^/]+)(?:\/([^/]+))?$/) || [];
  if (viewer && viewer.data.id === mapId) {
    if (placeId) viewer.selectById(placeId);
    else viewer.closeDetail();
    return;
  }
  viewer?.destroy();
  viewer = null;
  localURLs.forEach(url=>URL.revokeObjectURL(url));localURLs=[];
  document.body.classList.remove('viewer-open');
  try {
    maps ||= await loadJSON('data/maps.json', signal);
    if (signal.aborted || version !== routeVersion) return;
    if (!mapId) {
      const url=new URL(location.href);
      url.searchParams.delete('ancestry');url.searchParams.delete('seed');
      history.replaceState(null,'',url);
      document.title = 'The Wandering Atlas | Interactive fantasy maps';
      let local=[];
      try {local=await listLocalMaps();}catch(error){console.warn(error.message);}
      if(signal.aborted || version!==routeVersion)return;
      local=local.map(entry=>{const thumbnail=URL.createObjectURL(entry.thumbnailBlob);localURLs.push(thumbnail);return {...entry,thumbnail};});
      return renderLibrary(root, [...local,...maps], signal);
    }
    let record=mapId.startsWith('local-') ? await readLocalMap(mapId) : null;
    if(signal.aborted || version!==routeVersion)return;
    const entry = record ? record.map : maps.find(map => map.id === mapId);
    if (!entry) throw new Error(mapId.startsWith('local-') ? 'This local map is not stored in this browser. Restore its atlas backup from the collection.' : 'This map is not in the atlas. Return to the collection to choose another.');
    root.innerHTML = `<div class="loading-screen">${icon('compass')}<p>Unfolding ${escape(entry.name)}…</p></div>`;
    const source = numberSites(record ? record.map : await loadJSON(entry.data, signal));
    validateMap(source);
    const oldDraft = record ? {} : readDraft(source);
    const draft = {map:source,stale:oldDraft.local ? oldDraft.map : oldDraft.stale};
    let generationSettings=source.generator ? readSettings(draft.map,location.href,record ? undefined : {getItem:()=>null}) : null;
    if (signal.aborted || version !== routeVersion) return;
    document.body.classList.add('viewer-open');
    document.title = `${source.name} | The Wandering Atlas`;
    let saving;
    const mount = (next,placeId,settings=generationSettings) => {
      const previous=viewer?.stage;
      const view=previous && {scale:previous.scale,tx:previous.tx,ty:previous.ty};
      const layers=previous && {markers:previous.markers,streets:previous.streetLayer.enabled,numbers:previous.numberLayer.enabled,districts:previous.districtLayer.enabled};
      const filters=viewer?.filters,scope=viewer?.scope;
      const selectedId=placeId || viewer?.selected?.id;
      generationSettings=settings;
      if(settings) history.replaceState(null,'',settingsURL(location.href,settings));
      const previousURLs=localURLs;localURLs=[];
      const snapshot=settings ? applySettings(next,settings) : next;
      const data=materializeMap(record ? hydrateLocalMap(snapshot,record,localURLs) : snapshot);
      const saveEdit=map=>{
        if(saving)return saving;
        const owner=viewer;
        saving=(async()=>{
          if(record)record=await saveLocalMap(numberSites(map,next),record.image,record.thumbnail,record.initialMap);
          else record=await saveVariation(map,source,generationSettings,{signal:owner.signal});
          const url=new URL(`#map/${record.id}`,location.href);
          if(!owner.signal.aborted)history.replaceState(null,'',generationSettings ? settingsURL(url,generationSettings) : url);
          return record.map;
        })().finally(()=>{saving=null;});
        return saving;
      };
      const onGenerationChange=async settings=>{
        const owner=viewer,saved=await saveEdit({...next,settlementSettings:settings});
        if(owner.signal.aborted)return;
        saveSettings(saved,settings);mount(saved,undefined,settings);
        return true;
      };
      viewer?.destroy();previousURLs.forEach(url=>URL.revokeObjectURL(url));
      viewer = new AtlasViewer(root, data, {source:next,published:source,onChange:mount,local:next!==source,stale:draft.stale,generationSettings:settings,onGenerationChange,
        localMap:Boolean(record),
        onSave:saveEdit,
        onRestore:record ? async()=>{const map=numberSites(record.initialMap,record.map);record=await saveLocalMap(map,record.image,record.thumbnail,record.initialMap);return record.map;} : null,
        onBackup:record ? ()=>exportBackup(record,generationSettings) : null,
        onDelete:record ? async()=>{await deleteLocalMap(record.id);location.hash='';} : null});
      if(filters) {
        viewer.filters={...filters};viewer.root.querySelector('#place-search').value=filters.query;
        viewer.root.querySelector('#district-filter').value=filters.district;
        viewer.root.querySelectorAll('[data-category]').forEach(el=>{
          const active=el.dataset.category===filters.category;el.classList.toggle('active',active);el.setAttribute('aria-pressed',active);
        });
        viewer.setScope(scope);
      }
      if(view) {
        Object.assign(viewer.stage,view);viewer.stage.markers=layers.markers;
        viewer.stage.streetLayer.enabled=layers.streets;viewer.stage.numberLayer.enabled=layers.numbers;viewer.stage.districtLayer.enabled=layers.districts;
        for(const [key,value] of Object.entries(layers)) viewer.root.querySelector(`#toggle-${key}`).setAttribute('aria-pressed',value);
        viewer.stage.render();
      }
      if(selectedId) viewer.select(viewer.data.locations.find(p=>p.id===selectedId),!view);
    };
    mount(draft.map,placeId);
  } catch (error) {
    if (error.name === 'AbortError' || signal.aborted || version!==routeVersion) return;
    root.innerHTML = `<main class="error-page"><div class="eyebrow">A WRONG TURN</div><h1>The trail ends here.</h1><p>${escape(error.message)}</p><a class="button primary" href="#">Back to the atlas ${icon('arrow')}</a><button class="button" id="retry">Reload atlas</button></main>`;
    // Refresh the document and its release graph when an old open tab meets new data.
    document.querySelector('#retry').onclick = () => location.reload();
  }
}
document.querySelector('.skip-link').addEventListener('click',event=>{
  event.preventDefault();
  const main=document.querySelector('#main-content');
  if(main){main.tabIndex=-1;main.focus();main.scrollIntoView();}
});
window.addEventListener('hashchange', route);
route();
