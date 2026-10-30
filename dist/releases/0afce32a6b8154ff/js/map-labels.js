import { escape } from './ui.js';
import { boundsFor } from './geometry.js';
const feature=p=>['street','water','terrain'].includes(p.category);
const overlaps=(a,b)=>a.x<b.x+b.w && a.x+a.w>b.x && a.y<b.y+b.h && a.y+a.h>b.y;
export class MapLabels {
  constructor(world,data,districts) {
    this.data=data;this.districts=districts;
    this.el=document.createElement('div');this.el.className='map-feature-labels';world.append(this.el);
    this.cache=new Map();
    // Never materialize every resident and story merely to construct map labels.
    this.ordered=[...data.locations].sort((a,b)=>this.priority(b)-this.priority(a)||a.id.localeCompare(b.id));
  }
  priority(p) {return p.featured?100:p.category==='water'?90:p.category==='terrain'?80:p.category==='street'?(p.labelMinScale?35:65):p.category==='home'?5:20;}
  layout(stage) {
    const {scale,tx,ty,w,h}=stage;
    if(!scale)return;
    this.el.hidden=false;
    const occupied=[...(stage.numberRects || []),...stage.pinEls.filter(el=>!el.hidden).map(el=>{
      const p=stage.placeIndex.get(el.dataset.id);return {x:p.x*scale+tx-17,y:p.y*scale+ty-17,w:34,h:34};
    })];
    const visible=[];
    const placeLabel=(key,text,x,y,className,shiftable=true)=>{
      let el=this.cache.get(key);
      if(!el) {el=document.createElement('span');el.className=`map-feature-label ${className}`;el.innerHTML=escape(text);this.cache.set(key,el);this.el.append(el);}
      el.hidden=false;el.size ||= {w:el.offsetWidth+6,h:el.offsetHeight+4};
      const size=el.size;
      const shift=(shiftable?[0,20,-20,36]:[0]).find(d=>{
        const rect={x:x-size.w/2,y:y-size.h/2+d,...size};
        return rect.x>=8 && rect.y>=8 && rect.x+rect.w<w-8 && rect.y+rect.h<h-8 && !occupied.some(r=>overlaps(rect,r));
      });
      el.hidden=shift===undefined;
      if(el.hidden)return;
      el.style.left=`${(x-tx)/scale}px`;el.style.top=`${(y-ty)/scale}px`;el.style.setProperty('--label-shift',`${shift}px`);
      occupied.push({x:x-size.w/2,y:y-size.h/2+shift,...size});visible.push(key);
    };
    if(this.districts.enabled && scale<2) for(const d of this.districts.districts) {
      if(!d.label)continue;
      placeLabel(`district:${d.id}`,d.name,d.label.x*scale+tx,d.label.y*scale+ty,'district',true);
    }
    let count=0;
    for(const p of this.ordered) {
      if(p.category==='street'?!stage.streetLayer.enabled:!stage.markers)continue;
      if(stage.numberLayer.enabled && !feature(p))continue;
      const min=p.labelMinScale ?? (p.featured?1.2:feature(p)?(p.category==='street'?.8:.35):p.category==='home'?3.5:2.4);
      if(scale<min || !stage.visible(p))continue;
      const x=p.x*scale+tx,y=p.y*scale+ty;
      if(x<0||x>w||y<0||y>h)continue;
      // Small skerries and short alleys are useful only when zoomed in.
      const [, ,bw,bh]=boundsFor(p);
      if(feature(p)&&!p.overrides?.name&&Math.max(bw,bh)*scale<38)continue;
      placeLabel(p.id,p.name,x,y,p.category);
      if(++count>240)break;
    }
    const keep=new Set(visible);
    for(const [id,el] of this.cache)if(!keep.has(id))el.hidden=true;
    // Bound DOM growth while a visitor pans through thousands of buildings.
    if(this.cache.size>700)for(const [id,el] of this.cache)if(el.hidden){el.remove();this.cache.delete(id);}
  }
}
