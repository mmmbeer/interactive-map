import { calloutPosition, connectorEnd } from './callout-layout.js';
export class MapCallout {
  constructor(panel,stage,signal) {
    this.panel=panel;this.stage=stage;this.area=panel.parentElement;
    this.wire=this.area.querySelector('.callout-connector');
    this.line=this.wire.querySelector('line');this.dot=this.wire.querySelector('circle');
    const listen=(target,type,fn)=>target.addEventListener(type,fn,{signal});
    listen(panel,'pointerdown',e=>this.down(e));
    listen(panel,'pointermove',e=>this.move(e));
    listen(panel,'pointerup',e=>this.end(e));
    listen(panel,'pointercancel',e=>this.end(e));
    listen(panel,'lostpointercapture',e=>this.end(e));
    listen(panel,'keydown',e=>{
      if(!e.target.closest('.detail-grip') || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
      e.preventDefault();
      const n=e.shiftKey?5:20;
      this.shift({x:e.key==='ArrowLeft'?-n:e.key==='ArrowRight'?n:0,y:e.key==='ArrowUp'?-n:e.key==='ArrowDown'?n:0});
    });
    this.observer=new ResizeObserver(()=>this.update());this.observer.observe(this.area);this.observer.observe(panel);
    signal.addEventListener('abort',()=>{cancelAnimationFrame(this.frame);this.observer.disconnect();},{once:true});
  }
  show(place) {
    this.place=place;this.offset=null;this.drag=null;
    this.panel.scrollTop=0;this.panel.querySelector('.detail-body').scrollTop=0;
    this.update();
  }
  hide() {
    this.place=null;this.drag=null;this.panel.classList.remove('is-dragging');
    this.wire.setAttribute('hidden','');cancelAnimationFrame(this.frame);this.frame=null;
  }
  anchor() {
    const m=new DOMMatrixReadOnly(getComputedStyle(this.stage.world).transform);
    return {x:this.place.x*m.a+m.e,y:this.place.y*m.a+m.f};
  }
  update() {
    if(!this.place || this.panel.hidden)return;
    const w=this.area.clientWidth,h=this.area.clientHeight;
    this.panel.style.maxHeight=`${Math.max(100,Math.min(w<500?h*.58:560,h-86))}px`;
    const size={w:this.panel.offsetWidth,h:this.panel.offsetHeight},anchor=this.anchor();
    const pos=calloutPosition(anchor,size,{w,h},this.offset);
    this.position=pos;this.panel.style.left=`${pos.x}px`;this.panel.style.top=`${pos.y}px`;
    const end=connectorEnd(anchor,{...pos,...size});this.wire.toggleAttribute('hidden',!end);
    if(end) {
      for(const [key,value] of Object.entries({x1:anchor.x,y1:anchor.y,x2:end.x,y2:end.y}))this.line.setAttribute(key,value);
      this.dot.setAttribute('cx',anchor.x);this.dot.setAttribute('cy',anchor.y);
    }
    // Follow the displayed transform throughout animated navigation as well as direct panning.
    if(this.stage.world.classList.contains('navigating') && !this.frame) {
      this.frame=requestAnimationFrame(()=>{this.frame=null;this.update();});
    }
  }
  down(e) {
    if(e.button!==0 || !e.target.closest('.detail-grip'))return;
    e.preventDefault();this.stage.stopNavigation();
    this.drag={id:e.pointerId,x:e.clientX,y:e.clientY};
    this.panel.setPointerCapture(e.pointerId);this.panel.classList.add('is-dragging');
  }
  move(e) {
    if(this.drag?.id!==e.pointerId)return;
    this.shift({x:e.clientX-this.drag.x,y:e.clientY-this.drag.y});
    this.drag.x=e.clientX;this.drag.y=e.clientY;
  }
  shift(delta) {
    const anchor=this.anchor();
    this.offset={x:this.position.x+delta.x-anchor.x,y:this.position.y+delta.y-anchor.y};
    this.update();
    // Store the constrained position so a drag reverses immediately at an edge.
    this.offset={x:this.position.x-anchor.x,y:this.position.y-anchor.y};
  }
  end(e) {
    if(this.drag?.id!==e.pointerId)return;
    this.drag=null;this.panel.classList.remove('is-dragging');
    if(this.panel.hasPointerCapture(e.pointerId))this.panel.releasePointerCapture(e.pointerId);
  }
}
