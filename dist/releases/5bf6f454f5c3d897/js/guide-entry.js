import { socialLinksHTML } from './social-links.js';
import { categories, escape, icon } from './ui.js';
import { boundsFor } from './geometry.js';
export function guideCrop(place) {
  const [,,w,h]=boundsFor(place),span=Math.max(70,Math.min(180,Math.max(w,h)*2));
  return {x:place.x-span/2,y:place.y-span/2,w:span,h:span};
}
export function guideEntryHTML(place,index,data) {
  const category=categories[place.category],crop=guideCrop(place);
  const facts=[['People',place.person],['Services',place.services],...Object.values(place.extra || {}).filter(s=>s.text).map(s=>[s.label,s.text])].filter(([,text])=>text);
  const people=Object.entries(place.demographics || {}).map(([key,value])=>{
    const text=String(value).replaceAll('_',' ')+(key==='population'?' residents':'');
    return `<span title="${escape(key)}: ${escape(text)}"><span class="guide-sr">${escape(key)}: </span>${escape(text)}</span>`;
  }).join('');
  return `<article class="guide-entry" data-entry="${escape(place.id)}" tabindex="-1" style="--category:${category.color}">
    <button class="guide-site" data-site="${escape(place.id)}" title="Open ${escape(place.name)} on the map">
      <span class="guide-number">${index}</span><span class="guide-identity"><span class="guide-kind">${icon(category.icon)}${escape(category.singular)}</span><strong>${escape(place.name)}</strong><span class="guide-meta">${escape(place.district)}</span></span>
      <svg class="guide-map-crop" viewBox="${crop.x} ${crop.y} ${crop.w} ${crop.h}" aria-hidden="true" focusable="false"><image href="${escape(data.image)}" width="${data.width}" height="${data.height}"/><circle cx="${place.x}" cy="${place.y}" r="${crop.w*.065}" fill="#080357" stroke="#ffc15e" stroke-width="${crop.w*.025}"/><circle cx="${place.x}" cy="${place.y}" r="${crop.w*.018}" fill="#f5ff90"/></svg>
    </button>
    ${place.address?`<p class="guide-address">${icon('pin')}${escape(place.address)}</p>`:''}
    ${place.description?`<p class="guide-description">${escape(place.description)}</p>`:''}
    ${facts.length?`<dl class="guide-facts">${facts.map(([label,text])=>`<div><dt>${escape(label)}</dt><dd>${escape(String(text))}</dd></div>`).join('')}</dl>`:''}
    ${place.rumor?`<div class="guide-rumor"><span>${icon('book')}Word on the street</span><p>${escape(place.rumor)}</p></div>`:''}
    ${socialLinksHTML(place,true)}
    ${people?`<div class="guide-demographics" aria-label="Demographics">${people}</div>`:''}
  </article>`;
}
