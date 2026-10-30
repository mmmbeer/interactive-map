import { escape, icon, loadJSON } from './ui.js';
import { renderLibrary } from './library.js';
import { readDraft } from './authoring/drafts.js';
import { materializeMap } from './generation/locations.js';
import { validateMap } from './map-contract.js';
import { AtlasViewer } from './viewer.js';
import { applySettings, readSettings, saveSettings, settingsURL } from './generation/settlement-settings.js';
const root = document.querySelector('#app');
let viewer, maps, loadController, routeVersion = 0;
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
  document.body.classList.remove('viewer-open');
  try {
    maps ||= await loadJSON('data/maps.json', signal);
    if (signal.aborted || version !== routeVersion) return;
    if (!mapId) {
      const url=new URL(location.href);
      url.searchParams.delete('ancestry');url.searchParams.delete('seed');
      history.replaceState(null,'',url);
      document.title = 'The Wandering Atlas | Interactive fantasy maps';
      return renderLibrary(root, maps, signal);
    }
    const entry = maps.find(map => map.id === mapId);
    if (!entry) throw new Error('This map is not in the atlas. Return to the collection to choose another.');
    root.innerHTML = `<div class="loading-screen">${icon('compass')}<p>Unfolding ${escape(entry.name)}…</p></div>`;
    const source = await loadJSON(entry.data, signal);
    validateMap(source);
    const draft = readDraft(source);
    let generationSettings=source.generator ? readSettings(draft.map,location.href) : null;
    if (signal.aborted || version !== routeVersion) return;
    document.body.classList.add('viewer-open');
    document.title = `${source.name} | The Wandering Atlas`;
    const mount = (next,placeId,settings=generationSettings) => {
      const previous=viewer?.stage;
      const view=previous && {scale:previous.scale,tx:previous.tx,ty:previous.ty};
      const layers=previous && {markers:previous.markers,streets:previous.streetLayer.enabled,numbers:previous.numberLayer.enabled,districts:previous.districtLayer.enabled};
      const filters=viewer?.filters,scope=viewer?.scope;
      const selectedId=placeId || viewer?.selected?.id;
      generationSettings=settings;
      if(settings) history.replaceState(null,'',settingsURL(location.href,settings));
      const data=materializeMap(settings ? applySettings(next,settings) : next);
      const onGenerationChange=settings=>{
        const saved=saveSettings(next,settings);
        mount(next,undefined,settings);
        return saved;
      };
      viewer?.destroy();
      viewer = new AtlasViewer(root, data, {source:next,published:source,onChange:mount,local:next!==source,stale:draft.stale,generationSettings:settings,onGenerationChange});
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
    if (error.name === 'AbortError') return;
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
