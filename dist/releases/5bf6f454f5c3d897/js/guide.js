import { escape, icon, number, toast } from './ui.js';
import { guideEntryHTML } from './guide-entry.js';
import { createGuidePdf, mapImage } from './guide-pdf.js';
export function openGuide(viewer) {
  if(viewer.guide){viewer.guide.showModal();return;}
  const dialog=document.createElement('dialog');dialog.className='guide-dialog';viewer.root.append(dialog);viewer.guide=dialog;
  const sort=places=>[...places].sort((a,b)=>viewer.numbers.get(a.id)-viewer.numbers.get(b.id));
  const current=sort(viewer.results || []);let entries=current,limit=30,job,downloadURL;
  dialog.innerHTML=`<header class="guide-heading"><div class="guide-title"><div class="eyebrow">THE WANDERING ATLAS / SITE GUIDE</div><h2>${escape(viewer.data.name)}</h2></div><label class="guide-scope-label"><span>Include</span><select id="guide-scope"><option value="current">Current results (${number(current.length)})</option><option value="all">Entire map (${number(viewer.data.locations.length)})</option></select></label><button class="icon-button guide-close" aria-label="Close site guide">${icon('close')}</button></header>
    <div class="guide-workspace"><aside class="guide-index" aria-label="Site guide index"><div class="guide-index-heading">IN THIS GUIDE</div><nav aria-label="Jump to a site entry"></nav><p>Choose a number to find an entry. Choose its heading to open the map.</p></aside>
    <div class="guide-reading"><div class="guide-summary" role="status"></div><div class="guide-entries" tabindex="0" aria-label="Full site entries"><div class="guide-grid"></div><button class="button guide-more" hidden>Load more entries</button></div></div></div>
    <footer class="guide-footer"><span class="guide-export-note">Linked maps · Number index · Complete entries</span><span class="guide-progress" role="status" aria-live="polite"></span><a class="button guide-save" hidden>Save PDF</a><a class="button guide-open" target="_blank" rel="noopener" hidden>Open PDF</a><button class="button guide-cancel" hidden>Cancel export</button><button class="button primary guide-download">${icon('book')}Export PDF</button></footer>`;
  const list=dialog.querySelector('.guide-entries'),download=dialog.querySelector('.guide-download'),progress=dialog.querySelector('.guide-progress');
  function render() {
    const shown=entries.slice(0,limit);
    dialog.querySelector('.guide-summary').innerHTML=`<strong>${number(entries.length)} ${entries.length===1?'site':'sites'}</strong><span>${number(shown.length)} loaded</span>`;
    list.querySelector('.guide-grid').innerHTML=shown.map(p=>guideEntryHTML(p,viewer.numbers.get(p.id),viewer.data)).join('');
    dialog.querySelector('.guide-index nav').innerHTML=shown.map(p=>`<button data-jump="${escape(p.id)}"><span>${viewer.numbers.get(p.id)}</span><span><strong>${escape(p.name)}</strong><small>${escape(p.district)}</small></span></button>`).join('');
    dialog.querySelector('.guide-more').hidden=entries.length<=limit;
    dialog.querySelector('.guide-more').textContent=`Load ${Math.min(30,Math.max(0,entries.length-limit))} more entries`;
    download.disabled=Boolean(job)||!entries.length;
  }
  dialog.querySelector('#guide-scope').addEventListener('change',()=>{entries=dialog.querySelector('#guide-scope').value==='all'?sort(viewer.data.locations):current;
    if(downloadURL)URL.revokeObjectURL(downloadURL);downloadURL=null;dialog.querySelectorAll('.guide-save,.guide-open').forEach(a=>a.hidden=true);progress.textContent='';limit=30;list.scrollTop=0;render();},{signal:viewer.signal});
  dialog.addEventListener('click',async e=>{
    const button=e.target.closest('button');if(!button)return;
    if(button.classList.contains('guide-close'))dialog.close();
    if(button.classList.contains('guide-cancel'))job?.abort();
    if(button.classList.contains('guide-more')){limit+=30;render();}
    if(button.dataset.jump){
      const entry=[...list.querySelectorAll('[data-entry]')].find(el=>el.dataset.entry===button.dataset.jump);
      entry?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});entry?.focus({preventScroll:true});
      dialog.querySelectorAll('[data-jump]').forEach(el=>el.setAttribute('aria-current',String(el===button)));
    }
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
    finally {viewer.signal.removeEventListener('abort',abort);job=null;download.disabled=Boolean(job)||!entries.length;dialog.querySelector('#guide-scope').disabled=false;dialog.querySelector('.guide-cancel').hidden=true;}
  },{signal:viewer.signal});
  dialog.addEventListener('close',()=>{job?.abort();if(downloadURL)URL.revokeObjectURL(downloadURL);dialog.remove();viewer.guide=null;viewer.root.querySelector('#open-guide')?.focus();},{once:true});
  viewer.signal.addEventListener('abort',()=>{job?.abort();if(downloadURL)URL.revokeObjectURL(downloadURL);dialog.remove();},{once:true});
  if(!viewer.stage.numberLayer.enabled)viewer.stage.toggleNumbers();
  viewer.root.querySelector('#toggle-numbers').setAttribute('aria-pressed','true');
  render();dialog.showModal();
}
