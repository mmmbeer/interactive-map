import { regenerateContent } from '../local-maps/regeneration.js';
import { validateMap } from '../map-contract.js';
import { numberSites } from '../site-index.js';
import { normalizeProfile } from './settlement-profile.js';
import { normalizeSourceSelection } from './source-selection.js';
import { regionPlan } from './region-scale.js';
import { generateLayout } from './procedural-layout.js';
import { enrichSettlement } from './settlement-enrichment.js';
import { linkStreets } from './model.js';

export function regenerateLayout(source,settings,onProgress) {
  if(!source.worldImport?.bounds)throw new Error('Layout regeneration needs a real-world import with saved bounds.');
  const map=regenerateContent(source,settings),world=map.worldImport;
  // Older saves retain only a count of individual source trees, not their coordinates.
  world.mappedTreeCount=0;
  world.regionPlan ||= regionPlan(world.bounds);
  const selection=normalizeSourceSelection(world.sourceSelection || {version:2});
  const input={...world.settlement};
  if(settings.settlementType)input.type=settings.settlementType;
  if(settings.ancestry!=='original')Object.assign(input,{ancestry:settings.ancestry,secondary:''});
  const profile=normalizeProfile(input);
  // Keep the retained source geometry. Generated features must never become input to the next run.
  map.locations=map.locations.filter(p=>p.worldStyle?.origin!=='generated'&&!(p.worldStyle?.established&&p.worldStyle.kind!=='building'));
  const retained=new Set(map.locations.map(p=>p.id));
  for(const p of map.locations) {
    p.district='imported-area';
    if(p.worldStyle?.kind==='building'&&(p.worldStyle.established||p.worldStyle.useAssigned)) {
      p.category='home';p.type='home';delete p.worldStyle.established;delete p.worldStyle.useAssigned;
    }
    if(p.context)for(const key of ['street','water','terrain'])if(!retained.has(p.context[key]))delete p.context[key];
  }
  if(map.locationAliases)map.locationAliases=Object.fromEntries(Object.entries(map.locationAliases).filter(([,id])=>retained.has(id)));
  const mapped=profile.districtMode==='mapped'?map.districts.filter(d=>d.boundaries?.length):[];
  map.districts=[{id:'imported-area',name:'Imported area'}];
  delete world.procedural;delete world.planning;
  generateLayout(map,selection,profile,onProgress,4);
  linkStreets(map);
  enrichSettlement(map,profile,mapped);
  map.settlementSettings={...settings};
  const result=numberSites(map,source);
  validateMap(result);
  return {map:result,trees:[]};
}
