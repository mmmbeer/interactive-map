import { escape, icon, number, toast } from './ui.js';
import { entrySections } from './site-index.js';
import { createGuidePdf, mapImage } from './guide-pdf.js';
export function openGuide(viewer) {
  if(viewer.guide){viewer.guide.showModal();return;}
  const dialog=document.createElement('dialog');dialog.className='guide-dialog';viewer.root.append(dialog);viewer.guide=dialog;
  const sort=places=>[...places].sort((a,b)=>viewer.numbers.get(a.id)-viewer.numbers.get(b.id));
  const current=sort(viewer.results || []);let entries=current,limit=30,job,downloadURL;
  dialog.innerHTML=`<header class="guide-heading"><div><div class="eyebrow">NUMBERED SITE GUIDE</div><h2>${escape(viewer.data.name)}</h2></div><button class="icon-button guide-close" aria-label="Close site guide">${icon('close')}</button></header>
    <div class="guide-options"><label>Include<select id="guide-scope"><option value="current">Current directory results (${number(current.length)})</option><option value="all">Entire map (${number(viewer.data.locations.length)})</option></select></label><p>Numbers match the map. The PDF includes linked map sheets, a site index and complete entries with return links.</p></div>
    <div class="guide-summary" role="status"></div><div class="guide-entries" tabindex="0" aria-label="Full site entries"></div>
    <footer class="guide-footer"><span class="guide-progress" role="status" aria-live="polite"></span><a class="button guide-save" hidden>Save PDF</a><a class="button guide-open" target="_blank" rel="noopener" hidden>Open PDF</a><button class="button guide-cancel" hidden>Cancel export</button><button class="button primary guide-download">${icon('book')}Download linked PDF</button></footer>`;
  const list=dialog.querySelector('.guide-entries'),download=dialog.querySelector('.guide-download'),progress=dialog.querySelector('.guide-progress');
  function render() {
    dialog.querySelector('.guide-summary').textContent=`${number(entries.length)} sites · Showing ${number(Math.min(limit,entries.length))}. Zoom in on the map to reveal more numbers.`;
    list.innerHTML=entries.slice(0,limit).map(p=>`<article class="guide-entry"><button class="guide-site" data-site="${escape(p.id)}"><span>${viewer.numbers.get(p.id)}</span><strong>${escape(p.name)}</strong>${icon('arrow')}</button><p class="guide-meta">${escape(p.district)}${p.address?' · '+escape(p.address):''}</p>${entrySections(p).map(([label,text])=>`<section><h3>${escape(label)}</h3><p>${escape(String(text))}</p></section>`).join('')}</article>`).join('')+(entries.length>limit?'<button class="button guide-more">Show more full entries</button>':'');
    download.disabled=!entries.length;
  }
  dialog.addEventListener('change',()=>{entries=dialog.querySelector('#guide-scope').value==='all'?sort(viewer.data.locations):current;
    if(downloadURL)URL.revokeObjectURL(downloadURL);downloadURL=null;dialog.querySelectorAll('.guide-save,.guide-open').forEach(a=>a.hidden=true);progress.textContent='';limit=30;list.scrollTop=0;render();},{signal:viewer.signal});
  dialog.addEventListener('click',async e=>{
    const button=e.target.closest('button');if(!button)return;
    if(button.classList.contains('guide-close'))dialog.close();
    if(button.classList.contains('guide-cancel'))job?.abort();
    if(button.classList.contains('guide-more')){limit+=30;render();}
    if(button.dataset.site){dialog.close();viewer.selectById(button.dataset.site,true);}
    if(button!==download || job)return;
    job=new AbortController();const abort=()=>job?.abort();viewer.signal.addEventListener('abort',abort,{once:true});
    download.disabled=true;dialog.querySelector('#guide-scope').disabled=true;dialog.querySelector('.guide-cancel').hidden=false;
    dialog.querySelectorAll('.guide-save,.guide-open').forEach(a=>a.hidden=true);progress.textContent='Preparing map and fonts…';
    try {
      const image=await mapImage(viewer.stage.image,job.signal);
      const blob=await createGuidePdf(viewer.data,[...entries],{image,baseURL:location.href,signal:job.signal,onProgress:text=>progress.textContent=text});
      if(job.signal.aborted)throw new DOMException('Export cancelled.','AbortError');
      if(downloadURL)URL.revokeObjectURL(downloadURL);
      downloadURL=URL.createObjectURL(blob);const link=dialog.querySelector('.guide-save');link.href=downloadURL;link.download=`${viewer.data.id}-site-guide.pdf`;link.hidden=false;const open=dialog.querySelector('.guide-open');open.href=downloadURL;open.hidden=false;link.click();
      progress.textContent=`PDF ready. ${number(entries.length)} complete entries.`;
    } catch(error) {progress.textContent=error.name==='AbortError'?'Export cancelled.':error.message;if(error.name!=='AbortError')toast('PDF export failed. '+error.message);}
    finally {viewer.signal.removeEventListener('abort',abort);job=null;download.disabled=!entries.length;dialog.querySelector('#guide-scope').disabled=false;dialog.querySelector('.guide-cancel').hidden=true;}
  },{signal:viewer.signal});
  dialog.addEventListener('close',()=>{job?.abort();if(downloadURL)URL.revokeObjectURL(downloadURL);dialog.remove();viewer.guide=null;viewer.root.querySelector('#open-guide')?.focus();},{once:true});
  viewer.signal.addEventListener('abort',()=>{job?.abort();if(downloadURL)URL.revokeObjectURL(downloadURL);dialog.remove();},{once:true});
  if(!viewer.stage.numberLayer.enabled)viewer.stage.toggleNumbers();
  viewer.root.querySelector('#toggle-numbers').setAttribute('aria-pressed','true');
  render();dialog.showModal();
}
