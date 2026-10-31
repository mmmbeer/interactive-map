import { saveSettings } from '../generation/settlement-settings.js';
import { localMapId } from './identity.js';
import { toast } from '../ui.js';
import { validateMap } from '../map-contract.js';
import { prepareImage, importBackup } from './files.js';
import { saveLocalMap } from './store.js';
const colors={home:'#ff9f1c',water:'#32b4ea',terrain:'#55c04b',street:'#e32a83'};
export function openMapUpload(onSaved,signal) {
  const dialog=document.createElement('dialog');dialog.className='map-upload';
  dialog.innerHTML=`<form><header><div><span class="eyebrow">YOUR MAPS</span><h2>Upload a map</h2></div><button type="button" class="icon-button" id="upload-close" aria-label="Close upload">×</button></header>
    <p>Your map stays on this browser. Clearing site data removes local maps. Export an atlas backup to keep a separate copy. Upload PNG, JPEG or WebP artwork. You can also restore an atlas backup.</p>
    <label class="upload-file">Map image<input type="file" name="image" accept="image/png,image/jpeg,image/webp" required></label>
    <div class="upload-fields"><label>Map name<input name="name" maxlength="100" required placeholder="My map"></label><label>Generation seed<input name="seed" maxlength="128" value="my-map-v1" required></label></div>
    <details><summary>Recognition settings and existing geometry</summary><p>Color artwork works best. Dark ink marks building candidates. Bright narrow corridors mark roads. Blue marks water. Green marks terrain. Text, walls and decorations can create false matches.</p>
    <label>Building darkness threshold<input name="darkness" type="range" min="35" max="190" value="110"></label>
    <label>Sample color for <select name="sample"><option value="">No sampling</option><option value="building">Buildings</option><option value="road">Roads</option><option value="water">Water</option><option value="terrain">Terrain</option></select></label><p>Choose a feature above then click its color on the preview. <span id="sample-colors"></span></p>
    <label>Color tolerance<input name="tolerance" type="range" min="15" max="120" value="55"></label><button type="button" class="button" id="clear-colors">Reset sampled colors</button>
    <label>Annotated map JSON (optional)<input name="geometry" type="file" accept=".json,application/json"></label><p>Attach compact atlas map JSON to preserve every traced feature exactly. Image dimensions must match.</p></details>
    <div class="upload-preview" hidden><canvas aria-label="Map recognition preview"></canvas><div class="upload-legend">Orange: buildings · Pink: roads · Blue: water · Green: terrain</div></div>
    <p class="upload-status" role="status" aria-live="polite">Choose an image to start.</p><p class="upload-review" hidden>These are candidates. Districts follow color regions separated by roads and water. Review the overlay. Click a false match to remove it. After saving, use Edit map to add missed places, trace geometry or change categories and districts. Building uses and names are fictional.</p>
    <footer><label class="button">Restore backup<input id="restore-backup" type="file" accept=".json,application/json" hidden></label><button class="button" type="submit" id="process-map">Process map</button><button class="button primary" type="button" id="save-map" disabled>Save on this device</button></footer></form>`;
  document.body.append(dialog);
  const form=dialog.querySelector('form'),status=dialog.querySelector('.upload-status'),canvas=dialog.querySelector('canvas'),ctx=canvas.getContext('2d');
  const controller=new AbortController(),palette={};
  let prepared,image,map,worker,busy=false,revision=0;
  const on=(el,event,fn)=>el.addEventListener(event,fn,{signal:controller.signal});
  const fail=e=>{status.textContent=e.message;};
  const lock=value=>{busy=value;form.querySelectorAll('input,select,#clear-colors').forEach(el=>el.disabled=value);dialog.querySelector('#process-map').disabled=value;dialog.querySelector('#save-map').disabled=value||!map;};
  const invalidate=()=>{map=null;dialog.querySelector('#save-map').disabled=true;dialog.querySelector('.upload-review').hidden=true;draw();};
  function draw() {
    if(!prepared)return;
    canvas.width=prepared.w;canvas.height=prepared.h;ctx.drawImage(prepared.canvas,0,0);
    if(!map)return;
    ctx.save();ctx.scale(prepared.w/map.width,prepared.h/map.height);
    for(const d of map.districts)for(const shape of d.boundaries||[]) {
      ctx.beginPath();shape.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.strokeStyle='#544ed1';ctx.lineWidth=2*map.width/prepared.w;ctx.stroke();
    }
    for(const p of map.locations) {
      const shape=p.shape;ctx.beginPath();
      if(shape?.points){shape.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));if(shape.kind==='polygon')ctx.closePath();}
      else {const b=p.bounds||[p.x-4,p.y-4,8,8];ctx.rect(...b);}
      ctx.strokeStyle=colors[p.category]||'#ff9f1c';ctx.fillStyle=ctx.strokeStyle+'44';ctx.lineWidth=shape?.kind==='polyline'?shape.width:map.width/prepared.w;
      if(shape?.kind!=='polyline')ctx.fill();ctx.stroke();
    }ctx.restore();
  }
  on(form.elements.image,'change',async()=>{
    const version=++revision;worker?.terminate();lock(true);invalidate();
    try {
      const file=form.elements.image.files[0];if(!file){prepared=null;image=null;return;}
      const result=await prepareImage(file);if(version!==revision || controller.signal.aborted)return;
      image=file;prepared=result;form.elements.name.value=file.name.replace(/\.[^.]+$/,'');
      dialog.querySelector('.upload-preview').hidden=false;draw();status.textContent=`${prepared.width} × ${prepared.height} pixels. Ready to process.`;
    }catch(e){prepared=null;image=null;fail(e);}finally{if(version===revision)lock(false);}
  });
  on(form,'input',e=>{if(e.target.name!=='sample' && !busy)invalidate();});
  on(dialog.querySelector('#clear-colors'),'click',()=>{for(const key of Object.keys(palette))delete palette[key];dialog.querySelector('#sample-colors').textContent='';invalidate();});
  on(canvas,'click',async e=>{
    if(!prepared || busy)return;
    const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*prepared.w/rect.width,y=(e.clientY-rect.top)*prepared.h/rect.height;
    const kind=form.elements.sample.value;
    if(kind){palette[kind]=Array.from(prepared.canvas.getContext('2d').getImageData(Math.min(prepared.w-1,Math.floor(x)),Math.min(prepared.h-1,Math.floor(y)),1,1).data).slice(0,3);dialog.querySelector('#sample-colors').textContent=Object.keys(palette).join(', ')+' sampled';invalidate();return;}
    if(!map)return;
    const {contains}=await import('../geometry.js');
    const candidates=map.locations.filter(p=>contains(p,x*map.width/prepared.w,y*map.height/prepared.h));
    const place=candidates.find(p=>p.category==='home')||candidates[0];if(!place)return;
    map.locations=map.locations.filter(p=>p.id!==place.id);
    for(const p of map.locations)if(p.context)for(const [key,id] of Object.entries(p.context))if(id===place.id)delete p.context[key];
    draw();status.textContent=`Removed ${place.category} candidate. ${map.locations.length} features remain.`;
  });
  on(form,'submit',async e=>{
    e.preventDefault();if(busy || !prepared)return;
    invalidate();lock(true);status.textContent='Processing image on this device…';
    try {
      const id=localMapId(),name=form.elements.name.value.trim(),seed=form.elements.seed.value;
      if(!name || !seed.trim())throw new Error('Enter a map name and seed.');
      const geometry=form.elements.geometry.files[0];
      if(geometry) {
        if(geometry.size>10*1024*1024)throw new Error('Map JSON must be smaller than 10 MB.');
        map=JSON.parse(await geometry.text());validateMap(map);
        if(map.width!==prepared.width || map.height!==prepared.height)throw new Error('Geometry dimensions must match the uploaded image.');
        map={...map,id,name,image:`local/${id}/map`,thumbnail:`local/${id}/thumbnail`};
      } else {
        worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
        map=await new Promise((resolve,reject)=>{
          worker.onmessage=({data})=>{if(data.progress)status.textContent=data.progress;else if(data.error)reject(new Error(data.error));else resolve(data.map);};
          worker.onerror=()=>reject(new Error('The map processor could not run. Try a smaller image or attach annotated JSON.'));
          const rgba=prepared.rgba.slice();worker.postMessage({...prepared,canvas:undefined,thumbnail:undefined,rgba,id,name,seed,options:{palette:structuredClone(palette),darkness:Number(form.elements.darkness.value),tolerance:Number(form.elements.tolerance.value)}},[rgba.buffer]);
        });worker.terminate();worker=null;
      }
      if(controller.signal.aborted)return;
      draw();dialog.querySelector('.upload-review').hidden=false;
      const counts=Object.fromEntries(['home','street','water','terrain'].map(k=>[k,map.locations.filter(p=>p.category===k).length]));
      status.textContent=`${counts.home} buildings · ${counts.street} roads · ${counts.water} water areas · ${counts.terrain} terrain areas · ${map.districts.filter(d=>d.boundaries).length} suggested districts. Review before saving.`;
    } catch(e){map=null;fail(e);}finally{lock(false);}
  });
  on(dialog.querySelector('#save-map'),'click',async()=>{
    if(!map || busy)return;lock(true);
    try {validateMap(map);await saveLocalMap(map,image,prepared.thumbnail,map,{create:true});if(controller.signal.aborted)return;const id=map.id;dialog.close();toast('Map saved on this device.');onSaved(id);}catch(e){fail(e);lock(false);}
  });
  on(dialog.querySelector('#restore-backup'),'change',async e=>{
    if(busy)return;const file=e.target.files[0];if(!file)return;lock(true);
    try {const {map,image,thumbnail,settings}=await importBackup(file);if(controller.signal.aborted)return;await saveLocalMap(map,image,thumbnail,map,{create:true});if(controller.signal.aborted)return;if(settings)saveSettings(map,settings);dialog.close();onSaved(map.id);}catch(e){fail(e);lock(false);}
  });
  on(dialog.querySelector('#upload-close'),'click',()=>dialog.close());
  const close=()=>{dialog.close();worker?.terminate();controller.abort();dialog.remove();signal?.removeEventListener('abort',close);};
  on(dialog,'close',close);signal?.addEventListener('abort',close,{once:true});dialog.showModal();
}
