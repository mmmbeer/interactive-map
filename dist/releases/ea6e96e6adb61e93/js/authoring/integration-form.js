import { escape } from '../ui.js';
const select=(key,label,values,current)=>`<label>${label}<select name="content-${key}">${values.map(([value,title])=>`<option value="${escape(value)}" ${String(current ?? '')===String(value)?'selected':''}>${escape(title)}</option>`).join('')}</select></label>`;
const input=(key,label,value,type='text',extra='')=>`<label>${label}<input name="content-${key}" type="${type}" value="${escape(value ?? '')}" ${extra}></label>`;
const modes=[['','Automatic for location type'],['on','Enabled'],['off','Disabled']];
const mode=s=>s?.enabled===true?'on':s?.enabled===false?'off':'';
export function integrationForm(place) {
  const q=place.integrations?.quests || {},s=place.integrations?.sorrow || {},npc=s.npc || {};
  return `<fieldset class="editor-wide"><legend>Connected content</legend><p>Load deterministic content from NPC Sorrow and D&D Help Board in this location’s callout. Automatic uses the saved type and local context.</p><div class="editor-grid">
    ${select('quests','Quest board',modes,mode(q))}
    ${input('recipe','Board recipe (blank uses context)',q.locationId,'text','placeholder="guild, tavern, harbor, temple, college…"')}
    ${input('level','Party level',q.level ?? 3,'number','min="1" max="20" step="1"')}
    ${input('quest-count','Quest count',q.count ?? 6,'number','min="6" max="14" step="1"')}
    ${input('tone','Board tone',q.tone ?? 'Mixed')}
    ${select('sorrow','Grave stories',modes,mode(s))}
    ${input('grave-count','Grave story count (blank uses type)',s.count,'number','min="1" max="6" step="1"')}
    ${input('npc-name','Deceased name (one story only)',npc.name,'text','maxlength="48"')}
    ${input('npc-race','Deceased race (blank inherits)',npc.race)}
    ${input('npc-age','Deceased age or age group (blank inherits)',npc.age)}
    ${input('npc-sex','Deceased sex (blank inherits)',npc.sex)}
    ${input('npc-occupation','Deceased occupation (optional)',npc.occupation)}
    </div><small>Graveyard, cemetery, necropolis, tomb, crypt, mausoleum and grave types enable Sorrow. Guilds, shops, workshops, taverns, temples and harbors enable boards. Enable either provider for an authored landmark. Unsupported provider options show a message when loaded. Changes save only in your local variation.</small></fieldset>`;
}
export function readIntegrations(data,place) {
  const value=key=>String(data.get('content-'+key) ?? '').trim();
  // Older or programmatic forms without this section retain their settings.
  if(!data.has('content-quests'))return;
  const integrations={};
  for(const kind of ['quests','sorrow']) {
    const settings={};
    if(value(kind))settings.enabled=value(kind)==='on';
    if(kind==='quests') {
      if(value('recipe'))settings.locationId=value('recipe');
      if(value('tone') && value('tone')!=='Mixed')settings.tone=value('tone');
      if(value('level') && value('level')!=='3')settings.level=Number(value('level'));
      if(value('quest-count') && value('quest-count')!=='6')settings.count=Number(value('quest-count'));
    } else {
      if(value('grave-count'))settings.count=Number(value('grave-count'));
      const npc={};
      for(const field of ['name','race','age','sex','occupation'])if(value('npc-'+field)) {
        const text=value('npc-'+field);
        npc[field]=field==='age' && /^\d+$/.test(text)?Number(text):text;
      }
      if(Object.keys(npc).length)settings.npc=npc;
      if(npc.name && settings.count===undefined)settings.count=1;
    }
    if(Object.keys(settings).length)integrations[kind]=settings;
  }
  if(Object.keys(integrations).length)place.integrations=integrations;
  else delete place.integrations;
}
