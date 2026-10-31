import { escape, toast } from '../ui.js';
import { pathLength, calibration, formatDistance, travelTime } from './geometry.js';
const svgNS='http://www.w3.org/2000/svg';
export class TravelTools {
  constructor(viewer) {
    this.viewer=viewer;this.stage=viewer.stage;this.points=[];this.mode='measure';this.unit=viewer.source.measurement?.unit || 'm';this.request=0;
    this.el=document.createElement('section');this.el.className='travel-tools';this.el.hidden=true;this.el.setAttribute('aria-label','Distance and road routing');
    this.el.innerHTML=`<header><strong>Measure & route</strong><button class="icon-button" data-action="close" aria-label="Close measurement tools">×</button></header>
      <nav aria-label="Measurement tool"><button data-mode="measure" aria-pressed="true">Distance</button><button data-mode="route" aria-pressed="false">Road route</button><button data-mode="calibrate" aria-pressed="false">Set scale</button></nav>
      <p class="travel-help"></p><div class="travel-status" role="status" aria-live="polite"></div>
      <div class="travel-settings"><label>Distance unit<select name="unit"><option value="m">Meters</option><option value="km">Kilometers</option><option value="ft">Feet</option><option value="mi">Miles</option></select></label>
      <label class="travel-speed">Travel pace<select name="pace"><option value="4.8">Walk · 4.8 km/h</option><option value="8">Ride · 8 km/h</option><option value="3.2">Wagon · 3.2 km/h</option><option value="custom">Custom</option></select></label>
      <label class="travel-custom" hidden>Speed (km/h)<input name="speed" type="number" min="0.1" max="200" step="0.1" value="4.8"></label>
      <label class="travel-tolerance" hidden>Join road endpoint gaps (pixels)<input name="tolerance" type="number" min="0" max="20" step="0.5" value="3"></label>
      <label class="travel-known" hidden>Known distance<input name="known" type="number" min="0.0001" step="any" value="100"></label></div>
      <p class="travel-scale-note"></p><button class="button primary travel-save-scale" data-action="save-scale" hidden>Save scale locally</button>
      <div class="travel-actions"><button class="button" data-action="pick">Finish picking</button><button class="button" data-action="center">Add map center</button><button class="button" data-action="undo">Undo point</button><button class="button" data-action="clear">Clear</button></div>
      <details class="travel-directions" hidden><summary>Route directions</summary><ol></ol></details>`;
    viewer.root.querySelector('.map-area').append(this.el);
    this.overlay=document.createElementNS(svgNS,'svg');this.overlay.classList.add('travel-overlay');this.overlay.setAttribute('width',viewer.data.width);this.overlay.setAttribute('height',viewer.data.height);this.overlay.setAttribute('aria-hidden','true');this.stage.world.append(this.overlay);
    this.el.querySelector('[name=unit]').value=this.unit;
    const on=(target,type,fn)=>target.addEventListener(type,fn,{signal:viewer.signal});
    on(this.el,'click',e=>{
      const button=e.target.closest('button');if(!button)return;
      if(button.dataset.mode){this.mode=button.dataset.mode;if(this.mode==='calibrate')this.points=[];this.result=null;this.setPicking(true);this.calculate();}
      const actions={close:()=>this.close(),pick:()=>this.setPicking(!this.picking),center:()=>this.add({x:(this.stage.w/2-this.stage.tx)/this.stage.scale,y:(this.stage.h/2-this.stage.ty)/this.stage.scale}),undo:()=>{this.points.pop();this.calculate();},clear:()=>{this.points=[];this.setPicking(true);this.calculate();},'save-scale':()=>this.saveScale()};
      actions[button.dataset.action]?.();
    });
    on(this.el,'change',e=>{
      if(e.target.name==='unit')this.unit=e.target.value;
      if(e.target.name==='pace')this.el.querySelector('.travel-custom').hidden=e.target.value!=='custom';
      if(e.target.name==='tolerance')this.calculate();else this.render();
    });
    on(viewer.root,'keydown',e=>{
      if(this.el.hidden || ['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
      if(e.key==='Escape'){e.preventDefault();this.setPicking(false);}
      if(e.key==='Backspace' && this.stage.el.contains(e.target)){e.preventDefault();this.points.pop();this.calculate();}
    });
    viewer.signal.addEventListener('abort',()=>{this.worker?.terminate();this.overlay.remove();this.el.remove();},{once:true});
  }
  open(mode='measure',place) {
    if(!this.el.hidden && !place){this.close();return;}
    this.viewer.closeDetail();this.el.hidden=false;this.mode=mode;this.points=place?[{x:place.x,y:place.y}]:[];this.result=null;
    this.setPicking(true);this.calculate();this.el.querySelector(`[data-mode="${mode}"]`).focus();
  }
  close() {this.setPicking(false);this.el.hidden=true;this.overlay.replaceChildren();this.overlayParts=null;this.request++;this.viewer.root.querySelector('#open-travel')?.focus();}
  setPicking(value) {
    this.picking=value;this.stage.el.classList.toggle('travel-picking',value);
    this.stage.callbacks.point=value ? point=>{this.add(point);return true;} : null;
    this.el.querySelector('[data-action=pick]').textContent=value?'Finish picking':'Add points';
  }
  add(point) {
    if(point.x<0 || point.y<0 || point.x>this.viewer.data.width || point.y>this.viewer.data.height)return;
    if(this.mode==='calibrate' && this.points.length===2)this.points=[];
    if(this.points.length>=40){toast('A measurement can contain up to 40 points.');return;}
    this.points.push(point);this.calculate();
    if(this.mode==='calibrate' && this.points.length===2)this.setPicking(false);
  }
  calculate() {
    const id=++this.request;this.measureParts=null;this.result=null;this.error='';this.busy=false;
    if(this.mode!=='route' || this.points.length<2){this.render();return;}
    const tolerance=Number(this.el.querySelector('[name=tolerance]').value);
    if(!Number.isFinite(tolerance) || tolerance<0 || tolerance>20){this.error='Enter a road gap tolerance from 0 to 20 pixels.';this.render();return;}
    this.busy=true;
    if(!this.worker) {
      this.worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
      this.worker.onmessage=({data})=>{
        if(data.id!==this.request || this.viewer.signal.aborted)return;
        this.busy=false;this.result=data.result;this.error=data.error || '';this.render();
      };
      this.worker.onerror=()=>{this.busy=false;this.error='Routing could not run. Close and reopen the tools to retry.';this.worker.terminate();this.worker=null;this.render();};
      this.worker.postMessage({id,roads:this.viewer.source.locations.filter(p=>p.category==='street').map(p=>({id:p.id,category:p.category,shape:p.shape})),points:this.points,tolerance,maxSnapDistance:Math.max(20,Math.max(this.viewer.data.width,this.viewer.data.height)*0.03)});
    } else this.worker.postMessage({id,points:this.points,tolerance,maxSnapDistance:Math.max(20,Math.max(this.viewer.data.width,this.viewer.data.height)*0.03)});
    this.render();
  }
  render() {
    if(this.el.hidden)return;
    const scale=this.viewer.source.measurement,calibrate=this.mode==='calibrate',route=this.mode==='route';
    this.el.querySelectorAll('[data-mode]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.mode===this.mode)));
    this.el.querySelector('.travel-known').hidden=!calibrate;this.el.querySelector('.travel-save-scale').hidden=!calibrate;
    this.el.querySelector('.travel-save-scale').disabled=this.points.length!==2;
    this.el.querySelector('.travel-tolerance').hidden=!route;this.el.querySelector('.travel-speed').hidden=calibrate;
    this.el.querySelector('.travel-custom').hidden=calibrate || this.el.querySelector('[name=pace]').value!=='custom';
    this.el.querySelector('.travel-help').textContent=calibrate?'Mark two points with a known separation. Enter their distance and unit.':route?'Tap the start, destination, and any intermediate stops. Drag to pan.':'Tap successive points to measure a line or path. Drag to pan.';
    const length=route ? this.result?.length : pathLength(this.points);
    let status=this.error || (this.busy?'Finding a connected road route…':this.points.length<2?`${this.points.length} ${this.points.length===1?'point':'points'} selected. Choose ${this.points.length?'another point':'a starting point'}.`:length!==undefined?`${this.points.length} points · ${formatDistance(length,calibrate?null:scale,this.unit)}`:'');
    if(length!==undefined && scale && !calibrate) {
      const pace=this.el.querySelector('[name=pace]').value,speed=Number(pace==='custom'?this.el.querySelector('[name=speed]').value:pace);
      if(speed>=0.1 && speed<=200)status+=` · estimated ${travelTime(length,scale,speed)}`;
      else status+=' · enter a speed between 0.1 and 200 km/h';
    }
    this.el.querySelector('.travel-status').textContent=status;
    this.el.querySelector('.travel-scale-note').textContent=calibrate?'Scale saves only to your local variation.':scale?'Travel times assume constant pace. Road crossings are treated as junctions. Dashed lines show access paths and joined gaps.':'Distances use image pixels. Set scale to see real distances and estimated travel times.';
    this.el.querySelector('[data-action=undo]').disabled=!this.points.length;
    this.el.querySelector('.travel-directions').hidden=!route || !this.result;
    this.el.querySelector('.travel-directions ol').innerHTML=(this.result?.steps || []).map(step=>`<li>${escape(step.access?'Access path':step.gap?'Small endpoint gap':this.stage.placeIndex.get(step.roadId)?.name || 'Mapped road')} <span>${escape(formatDistance(step.length,scale,this.unit))}</span></li>`).join('');
    this.renderOverlay();
  }
  renderOverlay() {
    if(this.el.hidden)return;
    const parts=this.mode==='route' ? this.result?.parts || this.emptyParts || (this.emptyParts=[]) : this.measureParts || (this.measureParts=[{points:this.points}]);
    if(this.overlayParts!==parts || this.overlayPoints!==this.points || this.overlayCount!==this.points.length) {
      const paths={road:'',access:''};
      for(const part of parts) {
        const key=part.access || part.gap?'access':'road';
        paths[key]+=part.points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ');
      }
      this.overlay.innerHTML=`<path d="${paths.road}"/><path class="travel-access" d="${paths.access}"/>`+this.points.map((p,i)=>`<circle cx="${p.x}" cy="${p.y}"/><text data-x="${p.x}" data-y="${p.y}">${i+1}</text>`).join('');
      this.overlayParts=parts;this.overlayPoints=this.points;this.overlayCount=this.points.length;
    }
    this.overlay.querySelectorAll('circle').forEach(el=>el.setAttribute('r',5/this.stage.scale));
    this.overlay.querySelectorAll('text').forEach(el=>{
      el.setAttribute('x',Number(el.dataset.x)+9/this.stage.scale);el.setAttribute('y',Number(el.dataset.y)-9/this.stage.scale);el.setAttribute('font-size',13/this.stage.scale);
    });
  }
  async saveScale() {
    const button=this.el.querySelector('.travel-save-scale');button.disabled=true;
    try {
      const scale=calibration(this.points,Number(this.el.querySelector('[name=known]').value),this.unit);
      const map=structuredClone(this.viewer.source);map.measurement=scale;
      const saved=await this.viewer.onSave(map);
      if(this.viewer.signal.aborted)return;
      this.viewer.onChange(saved);toast('Scale saved to your local variation.');
    }catch(e){this.error=e.message;this.render();button.disabled=false;}
  }
}
