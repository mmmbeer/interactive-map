import { siteNumbers } from './site-index.js';
import { openGuide } from './guide.js';
import { openEditor } from './authoring/editor.js';
import { categories, escape, icon, number, toast } from './ui.js';
import { viewerHTML, listItem, detailHTML, tooltipHTML } from './places.js';
import { MapStage } from './map-stage.js';
import { matches, searchPlaces } from './spatial.js';
export class AtlasViewer {
  constructor(root,data,options={}) {
    this.staleDraft=options.stale;this.source=options.source || data;this.published=options.published || this.source;this.onChange=options.onChange;
    this.root=root;this.data=data;this.numbers=siteNumbers(data.locations);this.controller=new AbortController();this.signal=this.controller.signal;
    this.filters={query:'',category:'',district:''};this.scope='highlights';this.limit=45;
    root.innerHTML=viewerHTML(data);
    if(options.local || options.stale) {
      const note=document.createElement('div');note.className='local-draft-note';
      note.innerHTML=options.local ? 'Local draft · Changes are saved on this device.<button id="draft-tools">Export or restore</button>' : 'A draft from an older published map is stored on this device. Export it before restoring.<button id="draft-tools">Open draft tools</button>';
      root.querySelector('.atlas-header').after(note);
    }
    this.sidebar=root.querySelector('.place-sidebar');
    this.detail=root.querySelector('#detail-panel');this.tooltip=root.querySelector('#map-tooltip');
    this.stage=new MapStage(root.querySelector('#map-stage'),data,{
      select:p=>this.select(p),selectDistrict:d=>this.selectDistrict(d),hoverDistrict:(d,e)=>this.hoverDistrict(d,e),hover:(p,e)=>this.hover(p,e),view:v=>this.updateOverview(v)
    },this.signal);
    this.listen(root.querySelector('#place-search'),'input',e=>{
      this.filters.query=e.target.value.trim();
      if(this.filters.query) this.setScope('all',false);
      this.refresh();
    });
    this.listen(root.querySelector('#district-filter'),'change',e=>{this.filters.district=e.target.value;this.setScope('all',false);this.refresh();});
    this.listen(root,'click',e=>this.click(e));
    this.listen(root.querySelector('#place-list'),'pointerover',e=>{const id=e.target.closest('[data-place]')?.dataset.place;if(id)this.stage.highlight(this.stage.placeIndex.get(id));});
    this.listen(root.querySelector('#place-list'),'pointerleave',()=>this.stage.highlight(null));
    this.listen(document,'keydown',e=>{
      if(e.key==='Escape'&&!this.root.querySelector('dialog[open]')) {this.closeDetail(true);this.closeDirectory(true);this.hover(null);}
      if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)&&!e.target.isContentEditable) {
        e.preventDefault();this.openDirectory();root.querySelector('#place-search').focus();
      }
    });
    this.listen(root.querySelector('#overview-map'),'click',e=>{
      const rect=e.currentTarget.getBoundingClientRect();
      this.stage.center((e.clientX-rect.left)/rect.width*data.width,(e.clientY-rect.top)/rect.height*data.height);
    });
    this.mobileQuery=matchMedia('(max-width:760px)');
    this.listen(this.mobileQuery,'change',()=>this.syncDirectory());
    this.syncDirectory();
    this.refresh();
  }
  listen(target,type,callback) { target.addEventListener(type,callback,{signal:this.signal}); }
  click(e) {
    const target=e.target.closest('button');if(!target)return;
    if(target.dataset.scope) return this.setScope(target.dataset.scope);
    if(target.hasAttribute('data-category')) {
      this.filters.category=target.dataset.category;
      this.root.querySelectorAll('[data-category]').forEach(el=>{
        const active=el.dataset.category===this.filters.category;el.classList.toggle('active',active);el.setAttribute('aria-pressed',active);
      });
      this.setScope('all',false);return this.refresh();
    }
    if(target.dataset.place) return this.selectById(target.dataset.place,true);
    if(target.classList.contains('detail-close')) return this.closeDetail(true);
    if(target.classList.contains('sidebar-close')) return this.closeDirectory(true);
    if(target.classList.contains('detail-share')) return this.share();
    if(target.classList.contains('detail-edit')) return openEditor(this,this.selected);
    if(target.id==='edit-map' || target.id==='draft-tools') return openEditor(this);
    const handlers={
      'zoom-in':()=>this.stage.zoom(1.4,undefined,true),'zoom-out':()=>this.stage.zoom(1/1.4,undefined,true),
      'native-map':()=>this.stage.native(),'fit-map':()=>this.stage.fit(),'reset-map':()=>this.stage.reset(),
      'toggle-markers':()=>target.setAttribute('aria-pressed',this.stage.toggleMarkers()),
      'toggle-streets':()=>target.setAttribute('aria-pressed',this.stage.toggleStreets()),
      'toggle-numbers':()=>target.setAttribute('aria-pressed',this.stage.toggleNumbers()),
      'open-guide':()=>openGuide(this),
      'toggle-districts':()=>target.setAttribute('aria-pressed',this.stage.toggleDistricts()),
      'open-directory':()=>this.openDirectory(),'show-more':()=>{this.limit+=45;this.renderList();},
      'random-place':()=>{if(this.results.length)this.select(this.results[Math.floor(Math.random()*this.results.length)],true);},
      'share-map':()=>this.share(false),'about-map':()=>this.root.querySelector('#map-info').showModal()
    };
    if(target.classList.contains('dialog-close')) this.root.querySelector('#map-info').close();
    handlers[target.id]?.();
  }
  setScope(scope,refresh=true) {
    this.scope=scope;
    this.root.querySelectorAll('[data-scope]').forEach(el=>{
      const active=el.dataset.scope===scope;el.classList.toggle('active',active);el.setAttribute('aria-pressed',active);
    });
    if(refresh)this.refresh();
  }
  async refresh() {
    const version=this.searchVersion=(this.searchVersion || 0)+1;
    const filters={...this.filters},scope=this.scope;
    const places=this.data.locations.filter(p=>scope==='all'||p.featured);
    if(filters.query) {
      this.root.querySelector('#results-count').textContent='Searching places…';
      this.root.querySelector('#random-place').disabled=true;
    }
    const results=await searchPlaces(places,filters,{signal:this.signal,current:()=>this.searchVersion===version});
    if(!results || this.signal.aborted || this.searchVersion!==version)return;
    this.predicate=p=>matches(p,filters);
    this.results=results;
    this.limit=45;this.renderList();
    this.root.querySelector('#place-list').scrollTop=0;
    this.stage.filter(this.predicate,this.scope==='all',filters.district);
    this.root.querySelector('#random-place').disabled=!this.results.length;
  }
  renderList() {
    this.root.querySelector('#results-count').textContent=`${number(this.results.length)} ${this.scope==='highlights'?(this.results.length===1?'highlight':'highlights'):(this.results.length===1?'place':'places')}`;
    this.root.querySelector('#place-list').innerHTML=this.results.length?
      this.results.slice(0,this.limit).map(p=>listItem(p,this.numbers.get(p.id))).join('')+(this.results.length>this.limit?`<button class="load-more button" id="show-more">Show more places <span>${number(this.results.length-this.limit)} left</span></button>`:''):
      `<div class="empty-results">${icon('search')}<h3>No places found</h3><p>Try another name or choose a different type or neighborhood.</p></div>`;
    this.root.querySelectorAll('[data-place]').forEach(el=>el.classList.toggle('selected',el.dataset.place===this.selected?.id));
  }
  selectDistrict(district) {
    this.closeDetail();this.hover(null);this.stage.highlightDistrict(null);
    this.filters.district=district.name;this.root.querySelector('#district-filter').value=district.name;
    this.setScope('all',false);this.refresh();
    if(innerWidth<=760)this.openDirectory(false);
  }
  selectById(id,focus=false) {
    const place=this.data.locations.find(p=>p.id===id);
    if(place)this.select(place,true,focus);
    else toast('This place is not in the atlas. Choose a place from the directory.');
  }
  select(place,pan=true,focus=true) {
    if(!place)return;
    this.selected=place;this.hover(null);this.stage.select(place);
    this.detail.innerHTML=detailHTML(place,this.numbers.get(place.id));this.detail.hidden=false;
    if(pan) {
      this.stage.focus(place,innerWidth>760?this.detail.offsetWidth/2:0);
    }
    this.closeDirectory();
    history.replaceState(null,'',`#map/${this.data.id}/${place.id}`);
    this.root.querySelectorAll('[data-place]').forEach(el=>el.classList.toggle('selected',el.dataset.place===place.id));
    if(focus)this.detail.querySelector('h2').focus({preventScroll:true});
  }
  closeDetail(focus=false) {
    if(this.detail.hidden)return;
    this.detail.hidden=true;this.selected=null;this.stage.select(null);
    history.replaceState(null,'',`#map/${this.data.id}`);
    this.root.querySelectorAll('[data-place]').forEach(el=>el.classList.remove('selected'));
    if(focus)this.root.querySelector('#map-stage').focus({preventScroll:true});
  }
  hover(place,event) {
    if(!place||this.sidebar.classList.contains('mobile-open')) {this.tooltip.hidden=true;this.hovered=null;return;}
    if(this.hovered?.id!==place.id) {this.tooltip.innerHTML=tooltipHTML(place);this.hovered=place;}
    this.tooltip.hidden=false;
    this.positionTooltip(event);
  }
  hoverDistrict(district,event) {
    if(!district || this.sidebar.classList.contains('mobile-open'))return this.hover(null);
    const id=`district:${district.id}`;
    if(this.hovered?.id!==id){
      this.tooltip.innerHTML=`<span class="category-badge" style="--category:${district.color}">${icon('layers')}District</span><strong>${escape(district.name)}</strong><p>Explore the places in this neighborhood.</p><span class="tooltip-hint">Click to browse this district ${icon('arrow')}</span>`;
      this.hovered={id};
    }
    this.tooltip.hidden=false;this.positionTooltip(event);
  }
  positionTooltip(event) {
    const w=this.tooltip.offsetWidth,h=this.tooltip.offsetHeight;
    let x=event.clientX+20,y=event.clientY+20;
    if(x+w>innerWidth-12)x=event.clientX-w-20;
    if(y+h>innerHeight-12)y=event.clientY-h-16;
    this.tooltip.style.left=`${Math.max(10,x)}px`;this.tooltip.style.top=`${Math.max(10,y)}px`;
  }
  updateOverview(view) {
    this.root.querySelector('#zoom-status').textContent=`${Math.round(view.scale/view.min*100)}%`;
    if(view.raster)this.root.querySelector('#zoom-status').title=`${Math.round(view.raster.enlargement*100)}% of source pixel size. Use Native resolution to see the image without enlargement.`;
    const box=this.root.querySelector('.overview-viewport');
    const left=Math.max(0,-view.tx/view.scale),top=Math.max(0,-view.ty/view.scale);
    const right=Math.min(this.data.width,(view.w-view.tx)/view.scale),bottom=Math.min(this.data.height,(view.h-view.ty)/view.scale);
    box.style.cssText=`left:${left/this.data.width*100}%;top:${top/this.data.height*100}%;width:${(right-left)/this.data.width*100}%;height:${(bottom-top)/this.data.height*100}%`;
  }
  openDirectory(focus=true) {this.sidebar.classList.add('mobile-open');this.syncDirectory();if(focus)this.root.querySelector('#place-search').focus();}
  closeDirectory(focus=false) {
    const wasOpen=this.sidebar.classList.contains('mobile-open');
    this.sidebar.classList.remove('mobile-open');this.syncDirectory();
    if(focus&&wasOpen&&innerWidth<=760)this.root.querySelector('#open-directory').focus();
  }
  syncDirectory() {
    const closed=innerWidth<=760&&!this.sidebar.classList.contains('mobile-open');
    this.sidebar.inert=closed;
    this.sidebar.setAttribute('aria-hidden',String(closed));
    this.root.querySelector('#open-directory').setAttribute('aria-expanded',String(!closed));
  }
  async share(place=true) {
    const url=new URL(location.href);url.hash=`map/${this.data.id}${place&&this.selected?'/'+this.selected.id:''}`;
    try {
      await navigator.clipboard.writeText(url.href);toast('Link copied. Share a little discovery.');
    } catch {
      // A visible selectable link also works on browsers without clipboard permission.
      const dialog=this.root.querySelector('#map-info');
      let section=dialog.querySelector('.share-fallback');
      if(!section){section=document.createElement('div');section.className='share-fallback';dialog.append(section);}
      section.innerHTML=`<label>Copy this link<input readonly value="${escape(url.href)}"></label>`;
      if(!dialog.open)dialog.showModal();
      section.querySelector('input').select();
    }
  }
  destroy() {this.controller.abort();this.stage.destroy();}
}
