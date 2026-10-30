import { traceShape } from './geometry.js';
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
    this.pins = element.querySelector('.map-pins');
    this.pins.innerHTML = data.locations.filter(p => p.featured).map(p => `<button class="map-pin" data-id="${escape(p.id)}" aria-label="${escape(p.name)}: ${categories[p.category].singular}" style="left:${p.x}px;top:${p.y}px;--category:${categories[p.category].color}">${icon(categories[p.category].icon)}</button>`).join('');
    this.pinEls = [...this.pins.children];
    this.image = element.querySelector('.map-image');
    this.image.addEventListener('error', () => element.querySelector('.map-load-error').hidden = false, {signal});
    element.querySelector('.map-load-error button').addEventListener('click', () => {
      element.querySelector('.map-load-error').hidden = true;
      this.image.src = data.image + '?retry=' + Date.now();
    }, {signal});
    element.addEventListener('wheel', e => { e.preventDefault(); this.zoom(Math.exp(-e.deltaY * .0015), this.local(e)); }, {passive:false,signal});
    element.addEventListener('pointerdown', e => this.down(e), {signal});
    element.addEventListener('pointermove', e => this.move(e), {signal});
    element.addEventListener('pointerup', e => this.up(e), {signal});
    element.addEventListener('pointercancel', e => this.cancel(e), {signal});
    element.addEventListener('pointerleave', () => {this.callbacks.hover(null);this.highlight(null);}, {signal});
    element.addEventListener('click', e => {
      const pin = e.target.closest('.map-pin');
      if (pin && !this.dragged) callbacks.select(data.locations.find(p => p.id === pin.dataset.id));
    }, {signal});
    element.addEventListener('focusin', e => {
      const pin = e.target.closest('.map-pin');
      if (!pin) return;
      const place = data.locations.find(p => p.id === pin.dataset.id);
      this.center(place.x, place.y);
    }, {signal});
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
    const view = this.data.initialView;
    if (view) { this.scale = Math.max(this.min,Math.min(this.max,this.w/view.width)); this.center(view.x,view.y); }
    else this.fit();
  }
  fit() {
    this.scale = this.min;
    this.center(this.data.width/2,this.data.height/2);
  }
  center(x,y,animate = true) {
    this.tx = this.w/2-x*this.scale; this.ty = this.h/2-y*this.scale;
    this.render(animate);
  }
  focus(place) {
    this.scale = Math.min(this.max,Math.max(this.scale,1.8));
    this.center(place.x,place.y);
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
    this.callbacks.view?.({scale:this.scale,min:this.min,tx:this.tx,ty:this.ty,w:this.w,h:this.h});
  }
  down(event) {
    if (event.button !== 0 && event.pointerType !== 'touch') return;
    if (event.target.closest('.map-load-error')) return;
    this.stopNavigation();
    const p = this.local(event);
    this.pointers.set(event.pointerId,p);
    this.start = p; this.dragged = false;
    (event.target.closest('.map-pin')||this.el).setPointerCapture(event.pointerId);
    this.callbacks.hover(null);
    if (this.pointers.size>1) this.dragged = true;
  }
  move(event) {
    const next = this.local(event);
    if (!this.pointers.has(event.pointerId)) {
      if (event.pointerType==='touch') return;
      const place = this.at(next);
      this.el.classList.toggle('over-place',Boolean(place));
      this.callbacks.hover(place,event);
      this.highlight(place);
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
      else if (!event.target.closest('.map-pin')) {
        const place=this.at(point);if(place)this.callbacks.select(place);
      }
    }
    this.pointers.delete(event.pointerId);
    if (this.pointers.size) this.start = [...this.pointers.values()][0];
    this.el.classList.remove('dragging');
  }
  cancel(event) { this.pointers.delete(event.pointerId); this.dragged=true; this.el.classList.remove('dragging'); }
  at(point) {
    return hitTest(this.index,this.data.locations,(point.x-this.tx)/this.scale,(point.y-this.ty)/this.scale,this.scale,this.visible,this.markers);
  }
  key(event) {
    if (event.target.closest('.map-pin')) return;
    const actions = {
      '+':()=>this.zoom(1.4,undefined,true),'=':()=>this.zoom(1.4,undefined,true),'-':()=>this.zoom(1/1.4,undefined,true),'0':()=>this.fit(),
      ArrowLeft:()=>{this.tx+=70;this.render();},ArrowRight:()=>{this.tx-=70;this.render();},
      ArrowUp:()=>{this.ty+=70;this.render();},ArrowDown:()=>{this.ty-=70;this.render();}
    };
    if (actions[event.key]) {event.preventDefault();actions[event.key]();}
  }
  filter(predicate, showAll = false) {
    this.visible = predicate; this.showAll=showAll;
    this.pinEls.forEach(el => el.hidden = !this.markers || !predicate(this.data.locations.find(p=>p.id===el.dataset.id)));
    this.highlight(null);
  }
  toggleMarkers() {
    this.markers = !this.markers;
    this.filter(this.visible,this.showAll);
    return this.markers;
  }
  highlight(place) {
    const ctx = this.context;
    ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    if (this.showAll && this.markers) {
      for (const p of this.data.locations) {
        if (!this.visible(p) || p.featured) continue;
        ctx.fillStyle = categories[p.category].color+'55';
        traceShape(ctx,p); ctx.fill();
      }
    }
    for (const p of [this.selected,place]) {
      if (!p || !this.visible(p)) continue;
      ctx.fillStyle=categories[p.category].color+'99';traceShape(ctx,p);ctx.fill();
      ctx.strokeStyle='#fff9e9';ctx.lineWidth=2/this.scale;ctx.stroke();
    }
  }
  select(place) {
    this.selected=place; this.highlight(null);
    this.pinEls.forEach(el=>el.classList.toggle('selected',el.dataset.id===place?.id));
  }
  destroy() { clearTimeout(this.navigationTimer); this.resizeObserver.disconnect(); this.callbacks.hover(null); }
}
