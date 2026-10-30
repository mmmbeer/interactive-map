import { escape, icon, loadJSON } from './ui.js';
import { renderLibrary } from './library.js';
import { readDraft } from './authoring/drafts.js';
import { materializeMap } from './generation/locations.js';
import { validateMap } from './map-contract.js';
import { AtlasViewer } from './viewer.js';
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
      document.title = 'The Wandering Atlas | Interactive fantasy maps';
      return renderLibrary(root, maps, signal);
    }
    const entry = maps.find(map => map.id === mapId);
    if (!entry) throw new Error('This map is not in the atlas. Return to the collection to choose another.');
    root.innerHTML = `<div class="loading-screen">${icon('compass')}<p>Unfolding ${escape(entry.name)}…</p></div>`;
    const source = await loadJSON(entry.data, signal);
    validateMap(source);
    const draft = readDraft(source);
    const data = materializeMap(draft.map);
    if (signal.aborted || version !== routeVersion) return;
    document.body.classList.add('viewer-open');
    document.title = `${data.name} | The Wandering Atlas`;
    const mount = (next,placeId) => {
      const previous=viewer?.stage;
      const view=previous && {scale:previous.scale,tx:previous.tx,ty:previous.ty};
      const selectedId=placeId || viewer?.selected?.id;
      viewer?.destroy();
      viewer = new AtlasViewer(root, materializeMap(next), {source:next,published:source,onChange:mount,local:next!==source});
      if(view) {Object.assign(viewer.stage,view);viewer.stage.render();}
      if(selectedId && next.locations.some(p=>p.id===selectedId)) viewer.selectById(selectedId);
    };
    viewer = new AtlasViewer(root, data, {source:draft.map,published:source,onChange:mount,local:draft.local,stale:draft.stale});
    if (placeId) viewer.selectById(placeId);
  } catch (error) {
    if (error.name === 'AbortError') return;
    root.innerHTML = `<main class="error-page"><div class="eyebrow">A WRONG TURN</div><h1>The trail ends here.</h1><p>${escape(error.message)}</p><a class="button primary" href="#">Back to the atlas ${icon('arrow')}</a><button class="button" id="retry">Try again</button></main>`;
    document.querySelector('#retry').onclick = route;
  }
}
document.querySelector('.skip-link').addEventListener('click',event=>{
  event.preventDefault();
  const main=document.querySelector('#main-content');
  if(main){main.tabIndex=-1;main.focus();main.scrollIntoView();}
});
window.addEventListener('hashchange', route);
route();
