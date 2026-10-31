import { escape, icon } from './ui.js';
export function socialLinksHTML(place,guide=false) {
  const related=place.community?.related || [];
  if(!related.length)return '';
  return `<section class="detail-section social-links" aria-label="Connected places"><h3>Connected places</h3><div>${related.map(p=>`<button type="button" class="button quiet" ${guide?'data-site':'data-place'}="${escape(p.id)}" title="${escape(p.kind)}">${icon('pin')}<span>${escape(p.name)}</span></button>`).join('')}</div></section>`;
}
