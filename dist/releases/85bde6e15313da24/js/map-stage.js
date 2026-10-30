import { rasterQuality } from './raster-quality.js';
import { StreetLayer, NumberLayer } from './map-overlays.js';
import { siteNumbers } from './site-index.js';
import { DistrictLayer, hitTestDistrict } from './districts.js';
import { MapLabels } from './map-labels.js';
import { boundsFor, fillShape } from './geometry.js';
import { categories, icon, escape } from './ui.js';
import { buildSpatialIndex, hitTest } from './spatial.js';
export class MapStage {
  constructor(element, data, callbacks, signal) {
    this.el = element; this.data = data; this.callbacks = callbacks;
    this.pointers = new Map(); this.visible = () => true; this.markers = true;
    this.index = buildSpatialIndex(data.locations);
    element.innerHTML = `<div class="map-world"><img class="map-image" src="${escape(data.image)}" width="${data.width}" height="${data.height}" alt="${escape(data.name)} city map" draggable="false"><canvas class="map-overlay" aria-hidden="true"></canvas><div class="map-pins"></div></div><div class="map-load-error" hidden><p>The map image could not be loaded.</p><button class="button" type="button">Reload image</button></div>`;
    this.world = element.querySelector('.map-world');
    this.world.style.width = `${data.width}px`; this.world.style.height = `${data.height}px`;
    this.canvas = element.querySelector('canvas');
    this.canvas.width = data.width; this.canvas.height = data.height;
    this.context = this.canvas.getContext('2d');
    this.baseCanvas=document.createElement('canvas');this.baseCanvas.className='map-overlay';this.baseCanvas.width=data.width;this.baseCanvas.height=data.height;this.canvas.before(this.baseCanvas);
    this.pins = element.querySelector('.map-pins');
    this.pins.innerHTML = data.locations.filter(p => p.featured).map(p => `<button class="map-pin" data-id="${escape(p.id)}" aria-label="${escape(p.name)}: ${categories[p.category].singular}" style="left:${p.x}px;top:${p.y}px;--category:${categories[p.category].color}">${icon(categories[p.category].icon)}</button>`).join('');
    this.pinEls = [...this.pins.children];
    this.districtLayer=new DistrictLayer(this.world,data);
    this.streetLayer=new StreetLayer(this.world,data);
    this.numberLayer=new NumberLayer(this.world,siteNumbers(data.locations));
    this.selectionRing=document.createElement('span');this.selectionRing.className='map-selection-ring';this.selectionRing.hidden=true;this.world.append(this.selectionRing);
    this.labelLayer=new MapLabels(this.world,data,this.districtLayer);
    this.placeIndex=new Map(data.locations.map(p=>[p.id,p]));
    this.image = element.querySelector('.map-image');
    this.image.addEventListener('load',()=>this.render(),{signal});
    this.image.addEventListener('error', () => element.querySelector('.map-load-error').hidden = false, {signal});
    element.querySelector('.map-load-error button').addEventListener('click', () => {
      element.querySelector('.map-load-error').hidden = true;
      this.image.src = data.image + '?retry=' + Date.now();
    }, {signal});
    element.addEventListener('wheel', e => { e.preventDefault(); this.zoom(Math.exp(-e.deltaY * .0015), this.local(e),true); }, {passive:false,signal});
    element.addEventListener('pointerdown', e => this.down(e), {signal});
    element.addEventListener('pointermove', e => this.move(e), {signal});
    element.addEventListener('pointerup', e => this.up(e), {signal});
    element.addEventListener('pointercancel', e => this.cancel(e), {signal});
    element.addEventListener('lostpointercapture', e => this.cancel(e), {signal});
    element.addEventListener('pointerleave', () => {this.callbacks.hover(null);this.highlight(null);this.highlightDistrict(null);}, {signal});
    element.addEventListener('click', e => {
      const pin = e.target.closest('.map-pin,.site-number');
      if (pin && e.detail === 0) callbacks.select(this.placeIndex.get(pin.dataset.id));
    }, {signal});
    element.addEventListener('focusin', e => {
      const pin = e.target.closest('.map-pin,.site-number');
      if (!pin || this.pointers.size) return;
      const place = data.locations.find(p => p.id === pin.dataset.id);
      this.center(place.x, place.y);this.highlight(place);
    }, {signal});
    element.addEventListener('focusout',()=>this.highlight(null),{signal});
    element.addEventListener('keydown', e => this.key(e), {signal});
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(element);
    this.resize();
  }
  local(event) {
    const rect = this.el.getBoundingClientRect();
    return {x:event.clientX-rect.left,y:event.clientY-rect.top};
  }
  resize() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    const previous = this.w ? {x:(this.w/2-this.tx)/this.scale,y:(this.h/2-this.ty)/this.scale} : null;
    this.w = w; this.h = h;
    this.min = Math.min(w/this.data.width,h/this.data.height)*.94;
    this.max = Math.max(this.min*16, 4);
    if (!previous) this.reset();
    else { this.scale = Math.max(this.min,this.scale); this.center(previous.x,previous.y); }
  }
  reset() {
    this.stopNavigation();
    const view = this.data.initialView;
    if (view) { this.scale = Math.max(this.min,Math.min(this.max,this.w/view.width)); this.center(view.x,view.y); }
    else this.fit();
  }
  fit() {
    this.stopNavigation();
    this.scale = this.min;
    this.center(this.data.width/2,this.data.height/2);
  }
  center(x,y,animate = true) {
    this.tx = this.w/2-x*this.scale; this.ty = this.h/2-y*this.scale;
    this.render(animate);
  }
  native() {
    this.stopNavigation();
    const x=(this.w/2-this.tx)/this.scale,y=(this.h/2-this.ty)/this.scale;
    this.scale=Math.max(this.min,Math.min(this.max,rasterQuality(this.data.width,this.image.naturalWidth,this.scale,devicePixelRatio).nativeScale));
    this.center(x,y);
  }
  focus(place,offset=0) {
    this.stopNavigation();
    const [x,y,w,h]=boundsFor(place);
    const span=Math.max(w,h);
    this.scale = span>100 ? Math.max(this.min,Math.min(this.w/(w+100),this.h/(h+100),2)) : Math.min(this.max,Math.max(this.scale,2.8));
    this.tx=this.w/2-(span>100?x+w/2:place.x)*this.scale-offset;
    this.ty=this.h/2-(span>100?y+h/2:place.y)*this.scale;this.render(true);
  }
  zoom(factor, point = {x:this.w/2,y:this.h/2}, animate = false) {
    this.stopNavigation();
    const old = this.scale;
    this.scale = Math.max(this.min,Math.min(this.max,old*factor));
    this.tx = point.x-(point.x-this.tx)*this.scale/old;
    this.ty = point.y-(point.y-this.ty)*this.scale/old;
    this.callbacks.hover(null); this.render(animate);
  }
  constrain() {
    const sw = this.data.width*this.scale, sh = this.data.height*this.scale;
    this.tx = sw < this.w ? (this.w-sw)/2 : Math.max(this.w-sw-35,Math.min(35,this.tx));
    this.ty = sh < this.h ? (this.h-sh)/2 : Math.max(this.h-sh-35,Math.min(35,this.ty));
  }
  stopNavigation() {
    if (!this.world.classList.contains('navigating')) return;
    const matrix = new DOMMatrixReadOnly(getComputedStyle(this.world).transform);
    this.tx=matrix.e;this.ty=matrix.f;this.scale=matrix.a;
    this.world.classList.remove('navigating');
    clearTimeout(this.navigationTimer);
    this.render();
  }
  render(animate = false) {
    if (!this.w) return;
    this.constrain();
    if (animate && this.hasRendered && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.world.classList.add('navigating');
      clearTimeout(this.navigationTimer);
      this.navigationTimer=setTimeout(()=>this.world.classList.remove('navigating'),500);
    }
    this.hasRendered = true;
    this.world.style.transform = `translate(${this.tx}px,${this.ty}px) scale(${this.scale})`;
    this.world.style.setProperty('--inverse-scale',1/this.scale);
    this.raster=rasterQuality(this.data.width,this.image.naturalWidth,this.scale,devicePixelRatio);
    this.image.classList.toggle('is-enlarged',this.raster.enlarged);
    this.districtLayer.draw(this.scale,this.districtFilter,this.hoveredDistrict?.id);
    this.streetLayer.draw(this.scale,this.visible);
    this.layoutLabels();this.highlight(this.hovered);
    this.callbacks.view?.({scale:this.scale,min:this.min,tx:this.tx,ty:this.ty,w:this.w,h:this.h,raster:this.raster});
  }
  down(event) {
    if (event.button !== 0 && event.pointerType !== 'touch') return;
    if (event.target.closest('.map-load-error')) return;
    this.stopNavigation();
    const p = this.local(event);
    this.pointers.set(event.pointerId,p);
    if (this.pointers.size===1) {
      this.start=p;this.dragged=false;
      this.pressedPlace=event.target.closest('.map-pin,.site-number')?.dataset.id;
    }
    // Keep the gesture on a stable surface, even when labels move or disappear.
    if(event.pointerType!=='touch')event.preventDefault();
    this.el.setPointerCapture(event.pointerId);
    this.callbacks.hover(null);this.highlight(null);this.highlightDistrict(null);
    if (this.pointers.size>1) this.dragged = true;
  }
  move(event) {
    const next = this.local(event);
    if (!this.pointers.has(event.pointerId)) {
      if (event.pointerType==='touch') return;
      const id=event.target.closest('.map-pin,.site-number')?.dataset.id;
      const place = id?this.placeIndex.get(id):this.at(next);
      const district=this.districtAt(next,place);
      this.el.classList.toggle('over-place',Boolean(place||district));
      if(district)this.callbacks.hoverDistrict?.(district,event);else this.callbacks.hover(place,event);
      this.highlight(place);this.highlightDistrict(district);
      return;
    }
    const prev = this.pointers.get(event.pointerId);
    if (this.pointers.size===2) {
      const other = [...this.pointers.entries()].find(([id])=>id!==event.pointerId)[1];
      const before = Math.hypot(prev.x-other.x,prev.y-other.y);
      const after = Math.hypot(next.x-other.x,next.y-other.y);
      const mid = {x:(prev.x+other.x)/2,y:(prev.y+other.y)/2};
      if (before>5) this.zoom(after/before,mid);
      this.tx+=(next.x-prev.x)/2; this.ty+=(next.y-prev.y)/2;
      this.dragged = true;
    } else {
      if (Math.hypot(next.x-this.start.x,next.y-this.start.y)>5) this.dragged=true;
      if (this.dragged) { this.tx+=next.x-prev.x; this.ty+=next.y-prev.y; }
    }
    this.pointers.set(event.pointerId,next);
    this.el.classList.toggle('dragging',this.dragged);
    this.render();
  }
  up(event) {
    if (!this.pointers.has(event.pointerId)) return;
    if (!this.dragged) {
      const point=this.local(event);
      const consumed=this.callbacks.point?.({x:(point.x-this.tx)/this.scale,y:(point.y-this.ty)/this.scale});
      if (consumed) this.dragged=true;
      else {
        const place=this.pressedPlace?this.placeIndex.get(this.pressedPlace):this.at(point);
        if(place)this.callbacks.select(place);
        else {const district=this.districtAt(point,place);if(district)this.callbacks.selectDistrict?.(district);}
      }
    }
    this.pointers.delete(event.pointerId);
    if (this.pointers.size) this.start = [...this.pointers.values()][0];
    this.el.classList.remove('dragging');
  }
  cancel(event) {
    if(!this.pointers.has(event.pointerId))return;
    this.pointers.delete(event.pointerId);this.dragged=true;this.el.classList.remove('dragging');
  }
  at(point) {
    const m=new DOMMatrixReadOnly(getComputedStyle(this.world).transform);
    return hitTest(this.index,this.data.locations,(point.x-m.e)/m.a,(point.y-m.f)/m.a,m.a,this.visible,this.markers && !this.numberLayer.enabled,p=>this.visiblePinIds?.has(p.id));
  }
  districtAt(point,object=this.at(point)) {
    if(object || !this.districtLayer.enabled || !this.callbacks.selectDistrict)return null;
    const m=new DOMMatrixReadOnly(getComputedStyle(this.world).transform);
    return hitTestDistrict(this.districtLayer.districts,(point.x-m.e)/m.a,(point.y-m.f)/m.a,{enabled:this.districtLayer.enabled,object});
  }
  highlightDistrict(district) {
    if(this.hoveredDistrict?.id===district?.id)return;
    this.hoveredDistrict=district;this.districtLayer.draw(this.scale,this.districtFilter,district?.id);
  }
  key(event) {
    if (event.target.closest('.map-pin,.site-number')) return;
    const actions = {
      '+':()=>this.zoom(1.4,undefined,true),'=':()=>this.zoom(1.4,undefined,true),'-':()=>this.zoom(1/1.4,undefined,true),'0':()=>this.fit(),
      ArrowLeft:()=>{this.tx+=70;this.render();},ArrowRight:()=>{this.tx-=70;this.render();},
      ArrowUp:()=>{this.ty+=70;this.render();},ArrowDown:()=>{this.ty-=70;this.render();}
    };
    if (actions[event.key]) {event.preventDefault();this.stopNavigation();actions[event.key]();}
  }
  filter(predicate, showAll = false, district = '') {
    this.hoveredDistrict=null;this.districtFilter=district;this.districtLayer.draw(this.scale,district);
    this.visible = predicate; this.showAll=showAll;
    this.pinEls.forEach(el => el.hidden = !this.markers || !predicate(this.data.locations.find(p=>p.id===el.dataset.id)));
    this.streetLayer.draw(this.scale,predicate);this.layoutLabels();
    this.drawSites();this.highlight(null);
  }
  layoutLabels() { this.layoutPins();this.numberRects=this.numberLayer.layout(this);this.labelLayer.layout(this); }
  toggleStreets() {this.streetLayer.enabled=!this.streetLayer.enabled;this.streetLayer.draw(this.scale,this.visible);this.layoutLabels();return this.streetLayer.enabled;}
  toggleNumbers() {this.numberLayer.enabled=!this.numberLayer.enabled;this.layoutLabels();return this.numberLayer.enabled;}
  layoutPins() {
    if(!this.scale)return;
    const occupied=[];this.visiblePinIds=new Set();
    if(this.districtLayer.enabled && this.scale<2)for(const d of this.districtLayer.districts) {
      if(d.label)occupied.push({x:d.label.x*this.scale+this.tx,y:d.label.y*this.scale+this.ty,district:true});
    }
    const score=el=>el.dataset.id===this.selected?.id?100:['landmark','temple','harbor'].includes(this.placeIndex.get(el.dataset.id).category)?10:0;
    const pins=[...this.pinEls].sort((a,b)=>score(b)-score(a));
    const limit=this.scale<.7?18:this.scale<1.2?32:Infinity;let shown=0;
    for(const el of pins) {
      const p=this.placeIndex.get(el.dataset.id),x=p.x*this.scale+this.tx,y=p.y*this.scale+this.ty;
      const crowded=p.id!==this.selected?.id && occupied.some(q=>q.district?Math.abs(q.x-x)<65 && Math.abs(q.y-y)<24:Math.hypot(q.x-x,q.y-y)<32);
      el.hidden=this.numberLayer.enabled || !this.markers || (!this.visible(p) && p.id!==this.selected?.id) || x<0 || x>this.w || y<0 || y>this.h || crowded || shown>=limit;
      if(!el.hidden){occupied.push({x,y});shown++;this.visiblePinIds.add(p.id);}
    }
  }
  toggleDistricts() {
    this.highlightDistrict(null);this.callbacks.hover(null);
    const enabled=this.districtLayer.toggle(this.scale,this.districtFilter);this.layoutLabels();return enabled;
  }
  toggleMarkers() {
    this.markers = !this.markers;
    this.filter(this.visible,this.showAll,this.districtFilter);
    return this.markers;
  }
  drawSites() {
    const ctx=this.baseCanvas.getContext('2d');ctx.clearRect(0,0,this.data.width,this.data.height);
    if (this.showAll && this.markers) {
      for (const p of this.data.locations) {
        if (!this.visible(p) || p.featured || p.category==='street') continue;
        ctx.fillStyle = categories[p.category].color+(['water','terrain'].includes(p.category)?'18':p.category==='street'?'66':'55');
        fillShape(ctx,p);
      }
    }
  }
  highlight(place) {
    this.hovered=place;
    this.pinEls.forEach(el=>el.classList.toggle('hovered',el.dataset.id===place?.id));
    const ctx = this.context;
    ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    for (const p of [this.selected,place]) {
      if (!p) continue;
      ctx.save();ctx.shadowColor=categories[p.category].color;ctx.shadowBlur=5/this.scale;
      ctx.fillStyle=categories[p.category].color+(p===this.selected?'88':'55');fillShape(ctx,p);
      ctx.shadowBlur=0;ctx.strokeStyle=p===this.selected?'#ffffff':'#f5ff90';ctx.lineWidth=(p===this.selected?2.5:1.5)/this.scale;ctx.stroke();ctx.restore();
    }
  }
  select(place) {
    this.selected=place;this.selectionRing.hidden=!place;
    if(place){this.selectionRing.style.left=`${place.x}px`;this.selectionRing.style.top=`${place.y}px`;}
    this.highlight(null);this.layoutLabels();
    this.pinEls.forEach(el=>el.classList.toggle('selected',el.dataset.id===place?.id));
  }
  destroy() { clearTimeout(this.navigationTimer); this.resizeObserver.disconnect(); this.callbacks.hover(null); }
}

