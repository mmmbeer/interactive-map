import { brand, escape, icon, loadJSON, number } from './ui.js';
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
    if (!mapId) return renderLibrary();
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
function renderLibrary() {
  document.title = 'The Wandering Atlas | Interactive fantasy maps';
  const featured = maps[0];
  root.innerHTML = `
    <header class="site-header">${brand()}<nav aria-label="Main navigation"><a href="#collection"><span class="nav-dot"></span>The collection</a><a href="#how-it-works">A field guide ${icon('diagonal')}</a></nav></header>
    <main id="main-content">
      <section class="hero">
        <div class="hero-copy"><div class="eyebrow"><span></span> AN ATLAS FOR THE CURIOUS</div>
          <h1>Every place<br>has a <em>story.</em></h1>
          <p>Beyond the walls. Around the corner. Behind the next door. Explore imagined worlds, one place at a time.</p>
          <a class="button primary" href="#map/${escape(featured.id)}">Explore ${escape(featured.name)} ${icon('arrow')}</a>
          <div class="hero-note">${icon('compass')} A little wandering is the whole point.</div>
        </div>
        <a class="hero-map" href="#map/${escape(featured.id)}" aria-label="Explore ${escape(featured.name)}">
          <img src="${escape(featured.image)}" alt="The island city of Dragonsgate, with winding streets and sheltered quays" fetchpriority="high">
          <div class="map-paper-label"><span class="eyebrow">${escape(featured.region)}</span><strong>${escape(featured.name)}</strong><span>${escape(featured.subtitle)}.</span></div>
          <span class="hero-map-pin pin-one">${icon('castle')}</span><span class="hero-map-pin pin-two">${icon('cup')}</span><span class="hero-map-pin pin-three">${icon('anchor')}</span>
          <span class="hero-map-caption">UNFOLD THE MAP ${icon('diagonal')}</span>
          <div class="compass-rose" aria-hidden="true"><span>N</span>${icon('compass')}</div>
        </a>
      </section>
      <section class="collection-section" id="collection" aria-labelledby="collection-title">
        <div class="section-heading"><div><div class="eyebrow">PICK A PLACE. FOLLOW YOUR CURIOSITY.</div><h2 id="collection-title">The collection<span class="count-label">${String(maps.length).padStart(2,'0')}</span></h2></div><span class="collection-note">A growing atlas of imagined worlds</span></div>
        <div class="map-grid">${maps.map(map => `
          <a class="map-card" href="#map/${escape(map.id)}">
            <div class="card-image"><img src="${escape(map.thumbnail)}" alt="Overview of ${escape(map.name)}" loading="lazy"><span class="card-tag">${escape(map.theme)}</span><span class="card-open">${icon('diagonal')}</span></div>
            <div class="card-body"><div class="eyebrow">${escape(map.region)}</div><h3>${escape(map.name)}</h3><p>${escape(map.subtitle)}</p><div class="card-meta"><span>${icon('pin')} ${number(map.locationCount)} places to discover</span><span>Explore ${icon('arrow')}</span></div></div>
          </a>`).join('')}
          <div class="collection-aside"><div class="mini-rose">${icon('compass')}</div><blockquote>One map.<br>Thousands<br>of doorways.</blockquote><span>AN INVITATION TO EXPLORE</span><div class="aside-line"></div><p>Start with a city.<br>See where the streets take you.</p></div>
        </div>
      </section>
      <section class="field-guide" id="how-it-works" aria-labelledby="guide-title"><div><div class="eyebrow">A SMALL FIELD GUIDE</div><h2 id="guide-title">Let curiosity lead.</h2></div><div class="guide-step"><span>01</span><h3>Choose a map</h3><p>Unfold a world from the collection.</p></div><div class="guide-step"><span>02</span><h3>Look a little closer</h3><p>Drag to wander. Scroll or pinch to zoom.</p></div><div class="guide-step"><span>03</span><h3>Meet the neighborhood</h3><p>Hover over a building, or tap to open its story.</p></div></section>
    </main><footer class="site-footer">${brand()}<span>Imagined places. Unexpected stories.</span><a href="#collection">Back to the collection ${icon('arrow')}</a></footer>`;
  // In-page collection links work after returning from a map route too.
  if (['#collection','#how-it-works'].includes(location.hash)) {
    requestAnimationFrame(() => document.querySelector(location.hash)?.scrollIntoView());
  } else window.scrollTo(0, 0);
}
document.querySelector('.skip-link').addEventListener('click',event=>{
  event.preventDefault();
  const main=document.querySelector('#main-content');
  if(main){main.tabIndex=-1;main.focus();main.scrollIntoView();}
});
window.addEventListener('hashchange', route);
route();
