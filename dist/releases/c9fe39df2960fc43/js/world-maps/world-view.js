import { project, unproject, clamp, frameSize, areaBounds } from './geo.js';
// Navigation tiles are viewed normally. Export uses vector geometry, never these tiles.
export class WorldView {
  constructor(element,onChange,signal) {
    this.el=element;this.onChange=onChange;this.center=project(0,20);this.zoom=2;this.format='square';this.basemap='terrain';this.tiles=new Map();this.pointers=new Map();
    element.innerHTML='<div class="world-tiles"></div><div class="world-crop"><span>Export area</span></div><div class="world-tile-status" role="status"></div>';
    this.layer=element.querySelector('.world-tiles');this.crop=element.querySelector('.world-crop');this.status=element.querySelector('.world-tile-status');
    const on=(event,fn,options={})=>element.addEventListener(event,fn,{...options,signal});
    on('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;element.focus();element.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,[e.clientX,e.clientY]);this.gesture();});
    on('pointermove',e=>{
      if(!this.pointers.has(e.pointerId))return;this.pointers.set(e.pointerId,[e.clientX,e.clientY]);
      const now=this.gestureValue(),size=256*2**this.zoom;
      this.center[0]-=(now.x-this.last.x)/size;this.center[1]-=(now.y-this.last.y)/size;
      if(now.distance&&this.last.distance){
        this.zoom=clamp(this.zoom+Math.log2(now.distance/this.last.distance),2,20);
        const r=element.getBoundingClientRect(),after=256*2**this.zoom,dx=now.x-r.left-r.width/2,dy=now.y-r.top-r.height/2;
        this.center[0]+=dx/size-dx/after;this.center[1]+=dy/size-dy/after;
      }
      this.last=now;this.draw();
    });
    for(const event of ['pointerup','pointercancel','lostpointercapture'])on(event,e=>{this.pointers.delete(e.pointerId);this.gesture();});
    on('wheel',e=>{e.preventDefault();this.zoomAt(clamp(-e.deltaY*.003,-.6,.6),e.clientX,e.clientY);},{passive:false});
    on('dblclick',e=>this.zoomAt(1,e.clientX,e.clientY));
    on('keydown',e=>{
      if(['+','=','-','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))e.preventDefault();
      if(['+','=','-'].includes(e.key))this.zoomAt(e.key==='-'?-1:1);
      const move={ArrowUp:[0,-100],ArrowDown:[0,100],ArrowLeft:[-100,0],ArrowRight:[100,0]}[e.key];
      if(move){const size=256*2**this.zoom;this.center[0]+=move[0]/size;this.center[1]+=move[1]/size;this.draw();}
    });
    this.observer=new ResizeObserver(()=>this.draw());this.observer.observe(element);
    signal.addEventListener('abort',()=>{this.observer.disconnect();cancelAnimationFrame(this.frame);this.tiles.clear();},{once:true});this.draw();
  }
  gestureValue() {const pts=[...this.pointers.values()];return {x:pts.reduce((s,p)=>s+p[0],0)/pts.length,y:pts.reduce((s,p)=>s+p[1],0)/pts.length,distance:pts.length===2?Math.hypot(pts[0][0]-pts[1][0],pts[0][1]-pts[1][1]):0};}
  gesture() {this.last=this.gestureValue();}
  zoomAt(delta,clientX,clientY) {
    const r=this.el.getBoundingClientRect(),dx=(clientX??r.left+r.width/2)-r.left-r.width/2,dy=(clientY??r.top+r.height/2)-r.top-r.height/2;
    const before=256*2**this.zoom;this.zoom=clamp(this.zoom+delta,2,20);const after=256*2**this.zoom;
    this.center[0]+=dx/before-dx/after;this.center[1]+=dy/before-dy/after;this.draw();
  }
  go(lon,lat,zoom=16) {this.center=project(lon,lat);this.zoom=clamp(zoom,2,20);this.draw();}
  setFormat(format) {this.format=format;this.draw();}
  setBasemap(value) {this.basemap=value;for(const img of this.tiles.values()){img.onload=img.onerror=null;img.remove();}this.tiles.clear();this.draw();}
  bounds() {return areaBounds(this.center,this.zoom,this.frameRect);}
  draw() {
    const w=this.el.clientWidth,h=this.el.clientHeight;if(!w||!h)return;
    const size=256*2**this.zoom;
    this.center[0]=clamp(this.center[0],0,1);this.center[1]=clamp(this.center[1],Math.min(.5,h/size/2),Math.max(.5,1-h/size/2));
    const zoom=Math.min(this.basemap==='terrain'?17:19,Math.floor(this.zoom)),factor=2**(this.zoom-zoom),tileSize=256*factor,n=2**zoom,left=this.center[0]*size-w/2,top=this.center[1]*size-h/2,needed=new Set();
    for(let x=Math.max(0,Math.floor(left/tileSize));x<=Math.min(n-1,Math.floor((left+w)/tileSize));x++)for(let y=Math.max(0,Math.floor(top/tileSize));y<=Math.min(n-1,Math.floor((top+h)/tileSize));y++) {
      const key=`${zoom}/${x}/${y}`;needed.add(key);let img=this.tiles.get(key);
      if(!img) {
        img=document.createElement('img');img.alt='';img.draggable=false;img.decoding='async';
        img.onload=()=>{this.status.textContent='';};img.onerror=()=>{this.status.textContent='Navigation tiles unavailable. Check your connection. Coordinate selection still works.';};
        img.src=`${this.basemap==='terrain'?'https://a.tile.opentopomap.org':'https://tile.openstreetmap.org'}/${key}.png`;this.tiles.set(key,img);this.layer.append(img);
      }
      img.style.cssText=`left:${x*tileSize-left}px;top:${y*tileSize-top}px;width:${tileSize+.5}px;height:${tileSize+.5}px`;
    }
    for(const [key,img] of this.tiles)if(!needed.has(key)){img.onload=img.onerror=null;img.remove();this.tiles.delete(key);}
    this.frameRect=frameSize(w,h,this.format);const r=this.frameRect;
    this.crop.style.cssText=`left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px`;
    this.onChange(this.bounds(),unproject(...this.center),this.zoom);
  }
}
