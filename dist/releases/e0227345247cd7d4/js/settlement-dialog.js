import { settlementTypes } from './generation/economy-settlements.js';
import { escape, icon, toast } from './ui.js';
import { ancestries } from './generation/settlement-pools-v1.js';
import { defaultSettings, normalizeSettings } from './generation/settlement-settings.js';

export function openSettlementSettings(viewer) {
  if (!viewer.source.generator) return;
  const dialog=document.createElement('dialog');
  dialog.className='settlement-dialog';dialog.setAttribute('aria-labelledby','settlement-title');
  const current=viewer.generationSettings;
  dialog.innerHTML=`<form>
    <header><div><span class="eyebrow">THIS MAP’S GENERATION</span><h2 id="settlement-title">Settlement & seed</h2></div><button type="button" class="icon-button" data-close aria-label="Close settlement settings">${icon('close')}</button></header>
    <p>Choose a naming and craft tradition, settlement type and seed. Local geography and resources shape occupations, stock and work requests.</p>
    <label for="settlement-ancestry">Settlement ancestry</label><select id="settlement-ancestry" name="ancestry">${Object.entries(ancestries).map(([key,label])=>`<option value="${key}"${current.ancestry===key?' selected':''}>${escape(label)}</option>`).join('')}<option value="original"${current.ancestry==='original'?' selected':''}>As authored (map demographics)</option></select>
    <label for="settlement-type">Settlement type</label><select id="settlement-type" name="settlementType"><option value="original">As authored</option>${Object.entries(settlementTypes).map(([key,p])=>`<option value="${key}"${current.settlementType===key?' selected':''}>${escape(p.label)}</option>`).join('')}</select>
    <label for="settlement-seed">Generation seed</label><div class="seed-input"><input id="settlement-seed" name="seed" type="text" value="${escape(current.seed)}" required maxlength="128" spellcheck="false" autocomplete="off" aria-describedby="seed-help"><button type="button" class="button" data-new-seed title="Choose a new seed">${icon('dice')}<span>New seed</span></button></div>
    <p id="seed-help">Enter any word or number. Changing the seed regenerates names, residents and stories. It keeps locations and map shapes fixed.</p>
    <p class="settlement-note">Human is the default. Authored landmark names and text stay as written. Settings apply to search, labels and the site guide. Saving keeps them in your local variation.</p>
    <p class="settlement-error" role="status" aria-live="polite"></p>
    <footer><button type="button" class="button" data-reset>Reset to Human</button><button type="submit" class="button primary">Apply settings</button></footer>
  </form>`;
  document.body.append(dialog);
  const form=dialog.querySelector('form'),error=dialog.querySelector('.settlement-error');
  form.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-close'))dialog.close();
    if(button.hasAttribute('data-reset')) {
      const defaults=defaultSettings(viewer.source);
      form.elements.ancestry.value=defaults.ancestry;form.elements.seed.value=defaults.seed;form.elements.settlementType.value='original';error.textContent='';
    }
    if(button.hasAttribute('data-new-seed')) {
      const values=crypto.getRandomValues(new Uint32Array(4));
      form.elements.seed.value=Array.from(values,value=>value.toString(16).padStart(8,'0')).join('');
      error.textContent='New seed ready. Apply settings to regenerate this map.';
    }
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    try {
      const settings=normalizeSettings(viewer.source,{ancestry:form.elements.ancestry.value,seed:form.elements.seed.value,settlementType:form.elements.settlementType.value});
      const button=form.querySelector('[type=submit]');button.disabled=true;
      try {await viewer.onGenerationChange(settings);dialog.close();toast('Settlement settings saved to your local variation.');}
      finally {button.disabled=false;}
    } catch(e) {error.textContent=e.message;}
  });
  const dispose=()=>dialog.remove();
  viewer.signal.addEventListener('abort',dispose,{once:true});
  dialog.addEventListener('close',()=>{
    viewer.signal.removeEventListener('abort',dispose);dialog.remove();viewer.root.querySelector('#settlement-settings')?.focus();
  },{once:true});
  dialog.showModal();
}
