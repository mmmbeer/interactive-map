import { escape, icon, loadJSON } from './ui.js';
import { renderLibrary } from './library.js';
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
    const data = await loadJSON(entry.data, signal);
    if (signal.aborted || version !== routeVersion) return;
    document.body.classList.add('viewer-open');
    document.title = `${data.name} | The Wandering Atlas`;
    viewer = new AtlasViewer(root, data);
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
