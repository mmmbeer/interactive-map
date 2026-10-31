import { escape } from '../ui.js';
import { safeLink } from './client.js';
export function contentLink(kind,url,label) {
  const safe=safeLink(kind,url);
  return safe?`<a href="${escape(safe)}" target="_blank" rel="noopener noreferrer">${escape(label)} ↗</a>`:'';
}
const paragraph=(label,value)=>typeof value==='string' && value?`<p><strong>${escape(label)}</strong> ${escape(value)}</p>`:'';
export function questHTML(data,view) {
  return `<nav class="content-links" aria-label="Quest board links">${contentLink('quests',data.links.player,'Open player board')}${view==='dm'?contentLink('quests',data.links.dm,'Open DM board'):''}</nav>
    ${data.quests.map(q=>`<details class="external-entry"><summary>${escape(q.title)}</summary><div>
      <p class="external-prose">${escape(q.body)}</p>${paragraph('Reward:',q.reward)}${paragraph('Requester:',q.requester)}${paragraph('Meet at:',q.meetingPlace)}${paragraph('Deadline:',q.deadline)}
      ${view==='dm' && q.dm?`<section class="dm-reference"><h4>DM reference</h4>${['objective','danger','truth','complication','stakes'].map(key=>paragraph(key[0].toUpperCase()+key.slice(1)+':',q.dm[key])).join('')}</section>`:''}
      <nav class="content-links" aria-label="Quest links">${contentLink('quests',q.links.player,'Player notice')}${view==='dm'?contentLink('quests',q.links.dm,'DM encounter'):''}</nav>
    </div></details>`).join('')}`;
}
export function sorrowHTML(items,view) {
  return items.map((item,index)=>`<details class="external-entry"><summary>Grave ${index+1}: ${escape(item.npc.name)}</summary><div>
    <p class="external-prose">${escape(item.story.scene)}</p>${item.story.findings.map(f=>paragraph(f.label+':',f.text)).join('')}
    ${view==='dm'?`<p class="dm-reference">${escape([item.npc.race,item.npc.age,item.npc.skill].filter(Boolean).join(' · '))}${typeof item.npc.ageYears==='number'?` · ${item.npc.ageYears} years`:''}</p>`:''}
    <nav class="content-links" aria-label="Grave story links">${contentLink('sorrow',item.links.player,'Player handout')}${view==='dm'?contentLink('sorrow',item.links.dm,'DM reference'):''}</nav>
  </div></details>`).join('');
}
