export const categories = {
  landmark: { label: 'Landmarks', singular: 'Landmark', color: '#ff9f1c', icon: 'castle' },
  tavern: { label: 'Taverns & inns', singular: 'Tavern & inn', color: '#ffc15e', icon: 'cup' },
  shop: { label: 'Shops', singular: 'Shop', color: '#d6ffb7', icon: 'shop' },
  workshop: { label: 'Workshops', singular: 'Workshop', color: '#ffc15e', icon: 'tools' },
  temple: { label: 'Temples', singular: 'Temple', color: '#f5ff90', icon: 'spark' },
  guild: { label: 'Guilds', singular: 'Guild', color: '#d6ffb7', icon: 'shield' },
  harbor: { label: 'Harbor', singular: 'Harbor', color: '#d6ffb7', icon: 'anchor' },
  street: {label:'Streets & routes',singular:'Street or route',color:'#ffc15e',icon:'route'},
  water: {label:'Water',singular:'Body of water',color:'#95dce7',icon:'water'},
  terrain: {label:'Geography',singular:'Geographic feature',color:'#d6ffb7',icon:'terrain'},
  home: { label: 'Homes', singular: 'Home', color: '#f5ff90', icon: 'home' }
};
const paths = {
  index:'<path d="M9 5h12M9 12h12M9 19h12M2 4h2v3M2 11h3l-3 3h3M2 18h3v4H2m1-2h2"/>',
  route:'<path d="m4 20 5-16m6 16 5-16M12 8l1-4m-3 12 1-4"/>',
  water:'<path d="M2 8q3-4 6 0t6 0 6 0M2 13q3-4 6 0t6 0 6 0M2 18q3-4 6 0t6 0 6 0"/>',
  terrain:'<path d="m2 20 7-14 5 9 3-5 5 10ZM6 12l3 2 3-2"/>',
  compass: '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z"/><circle cx="12" cy="12" r="2"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  diagonal: '<path d="M6 18 18 6M6 6h12v12"/>',
  back: '<path d="m14 6-6 6 6 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  fit: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  layers: '<path d="m12 3 10 6-10 6L2 9Zm-10 12 10 6 10-6M2 15l10 6 10-6"/>',
  share: '<path d="M12 16V3m-4 4 4-4 4 4M5 11H3v10h18V11h-2"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  book: '<path d="M12 5v16M3 3l9 2 9-2v16l-9 2-9-2Z"/>',
  castle: '<path d="M3 21V8h4v4h3V8h4v4h3V8h4v13ZM3 8V3h4v5m10 0V3h4v5M10 21v-5h4v5"/>',
  cup: '<path d="M5 4h12v10a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5ZM17 6h2a3 3 0 0 1 0 6h-2M3 22h16"/>',
  shop: '<path d="M4 10v11h16V10M2 10l3-7h14l3 7ZM9 21v-7h6v7M2 10a3 3 0 0 0 5 2 3 3 0 0 0 5 0 3 3 0 0 0 5 0 3 3 0 0 0 5-2"/>',
  tools: '<path d="m14 5 5 5M4 20l3-1L20 6l-2-2L5 17ZM3 4l3-1 5 5-3 3Zm10 11 6 6 3-3-6-6"/>',
  spark: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>',
  shield: '<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Z"/><path d="m8 12 3 3 5-6"/>',
  anchor: '<circle cx="12" cy="5" r="3"/><path d="M12 8v14M7 11h10M3 14v4l9 4 9-4v-4M3 18l4-2m14 2-4-2"/>',
  home: '<path d="m2 11 10-8 10 8M5 9v12h14V9M10 21v-7h4v7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'
};
export function icon(name, className = '') {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.pin}</svg>`;
}
export function escape(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
export function brand() {
  return `<a class="brand" href="#" aria-label="The Wandering Atlas home"><img src="assets/compass.svg" width="38" height="38" alt=""><span>The Wandering <em>Atlas</em><small>INTERACTIVE WORLDS</small></span></a>`;
}
let toastTimer;
export function toast(message) {
  const el = document.querySelector('#toast');
  el.textContent = message;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 3500);
}
export async function loadJSON(path, signal) {
  const response = await fetch(path, { signal });
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status}).`);
  return response.json();
}
export function categoryBadge(category) {
  const item = categories[category];
  return `<span class="category-badge" style="--category:${item.color}">${icon(item.icon)}${item.singular}</span>`;
}
export function number(value) { return value.toLocaleString('en-US'); }

