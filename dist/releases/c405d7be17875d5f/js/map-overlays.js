import { traceShape } from './geometry.js';
import { isGeography } from './site-index.js';
export class StreetLayer {
  constructor(world,data) {
    this.enabled=true;this.streets=data.locations.filter(p=>p.category==='street');
    this.canvas=document.createElement('canvas');this.canvas.className='map-street-overlay';
    this.canvas.width=data.width;this.canvas.height=data.height;world.querySelector('.map-overlay').before(this.canvas);
    this.ctx=this.canvas.getContext('2d');
  }
  draw(scale,visible=()=>true) {
    if(this.lastScale===scale && this.lastVisible===visible && this.lastEnabled===this.enabled)return;
    this.lastScale=scale;this.lastVisible=visible;this.lastEnabled=this.enabled;
    this.canvas.classList.toggle('layer-off',!this.enabled);
    const ctx=this.ctx;if(!this.enabled)return;
    ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    ctx.lineCap='round';ctx.lineJoin='round';
    for(const p of this.streets) {
      if(!visible(p))continue;
      traceShape(ctx,p);
      const width=p.shape?.width || 2;
      ctx.strokeStyle='#08035799';ctx.lineWidth=Math.max(width,2/scale)+2/scale;ctx.stroke();
      ctx.strokeStyle='#ffc15ecc';ctx.lineWidth=Math.max(width*.5,1.3/scale);ctx.stroke();
    }
  }
}
export class NumberLayer {
  constructor(world,numbers) {
    this.numbers=numbers;this.enabled=false;this.cache=new Map();
    this.el=document.createElement('div');this.el.className='map-site-numbers';world.append(this.el);
  }
  layout(stage) {
    this.el.hidden=!this.enabled;const occupied=[];const keep=new Set();
    if(!this.enabled)return occupied;
    const {scale,tx,ty,w,h}=stage;
    const places=stage.selected?[stage.selected,...stage.data.locations.filter(p=>p.id!==stage.selected.id)]:stage.data.locations;
    for(const p of places) {
      if(isGeography(p) || (!stage.visible(p) && p.id!==stage.selected?.id))continue;
      const x=p.x*scale+tx,y=p.y*scale+ty,num=this.numbers.get(p.id),bw=String(num).length*6+12;
      const rect={x:x-bw/2,y:y-9,w:bw,h:18};
      if(x<0||x>w||y<0||y>h || occupied.some(r=>rect.x<r.x+r.w+3 && rect.x+rect.w+3>r.x && rect.y<r.y+r.h+3 && rect.y+rect.h+3>r.y))continue;
      let el=this.cache.get(p.id);
      if(!el){el=document.createElement('button');el.className='site-number';el.dataset.id=p.id;el.textContent=num;el.setAttribute('aria-label',`Site ${num}: ${p.name}`);this.cache.set(p.id,el);this.el.append(el);}
      el.hidden=false;el.classList.toggle('selected',p.id===stage.selected?.id);
      el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;keep.add(p.id);occupied.push(rect);
      if(keep.size>=220)break;
    }
    for(const [id,el] of this.cache)if(!keep.has(id))el.hidden=true;
    if(this.cache.size>600)for(const [id,el] of this.cache)if(el.hidden){el.remove();this.cache.delete(id);}
    return occupied;
  }
}
