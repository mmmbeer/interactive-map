import { escape } from '../ui.js';
import { integrationSettings } from './config.js';
import { questRequest, sorrowRequests } from './requests.js';
import { ContentClient } from './client.js';
import { questHTML, sorrowHTML } from './render.js';
const titles={quests:'Quest board',sorrow:'Grave stories'};
const descriptions={quests:'Local postings from D&D Help Board.',sorrow:'Stories and keepsakes from NPC Sorrow. These are deceased characters, separate from the site’s living residents.'};
export class ConnectedContent {
  constructor(viewer) {
    this.viewer=viewer;this.client=new ContentClient();
    viewer.detail.addEventListener('click',e=>{
      const button=e.target.closest('[data-content-action]');
      if(!button)return;
      const kind=button.closest('[data-content-kind]').dataset.contentKind;
      const state=this.states[kind];
      if(button.dataset.contentAction==='view')state.view=button.dataset.view;
      this.load(kind);
    },{signal:viewer.signal});
    viewer.signal.addEventListener('abort',()=>this.close(),{once:true});
  }
  select(place) {
    this.close();this.place=place;this.states={};
    const settings=integrationSettings(place);
    const container=document.createElement('div');container.className='connected-content';
    for(const kind of ['sorrow','quests'])if(settings[kind].enabled) {
      const section=document.createElement('section');section.className='detail-section external-content';section.dataset.contentKind=kind;
      container.append(section);this.states[kind]={section,view:'player',status:'idle'};this.render(kind);
    }
    this.viewer.detail.querySelector('.detail-content').append(container);
  }
  render(kind) {
    const state=this.states[kind],{section,view,status}=state;
    section.innerHTML=`<h3>${titles[kind]}</h3><p class="external-source">${descriptions[kind]}</p>
      <div class="external-controls" role="group" aria-label="${titles[kind]} view">${['player','dm'].map(v=>`<button type="button" class="button" data-content-action="view" data-view="${v}" aria-pressed="${view===v}">${v==='dm'?'DM view':'Player view'}</button>`).join('')}</div>
      ${view==='dm'?'<p class="external-source">DM details and links are public reference views.</p>':''}
      <div class="external-status" role="status" aria-live="polite">${status==='loading'?'Loading content…':status==='error'?escape(state.error):status==='loaded'?'Content loaded.':''}</div>
      ${status==='idle' || status==='error'?`<button type="button" class="button" data-content-action="load">${status==='error'?'Retry':kind==='quests'?'Load quest board':'Load grave stories'}</button>`:''}
      ${status==='loaded'?(kind==='quests'?questHTML(state.data,view):sorrowHTML(state.data,view)):''}`;
    section.setAttribute('aria-busy',String(status==='loading'));
    this.viewer.callout?.update();
  }
  async load(kind) {
    const state=this.states[kind];state.controller?.abort();
    const controller=state.controller=new AbortController(),signal=controller.signal;
    const place=this.place,view=state.view;
    state.status='loading';this.render(kind);
    try {
      const options=await this.client.getOptions(kind,signal),map=this.viewer.generationSource;
      const data=kind==='quests'
        ? await this.client.generate(kind,questRequest(map,place,options,view),signal)
        : (await Promise.all(sorrowRequests(map,place,options).map(input=>this.client.generate(kind,input,signal)))).map(d=>d.items[0]);
      if(signal.aborted || this.states[kind]!==state)return;
      state.data=data;state.status='loaded';
    } catch(error) {
      if(signal.aborted)return;
      // Cancel sibling grave requests when one fails. Retrying retains successful snapshots.
      controller.abort();state.status='error';state.error=error.message;
    }
    this.render(kind);
  }
  close() {
    for(const state of Object.values(this.states || {}))state.controller?.abort();
    this.states={};this.place=null;
  }
}
