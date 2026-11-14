import { normalizeSettings } from '../generation/settlement-settings.js';
import { validateMap } from '../map-contract.js';
import { variationModel } from './variations.js';
import { saveLocalMap } from './store.js';

export function regenerateContent(source,input) {
  validateMap(source);
  if(!source.generator)throw new Error('This map has no generated content.');
  const settings=normalizeSettings(source,input),map=structuredClone(source);
  map.generator.seed=settings.seed===String(source.generator.seed)?source.generator.seed:settings.seed;
  map.settlementSettings=settings;
  return map;
}
export async function saveRegeneration(next,source,settings,{record,files,signal,fetchAsset=fetch,save=saveLocalMap}={}) {
  signal?.throwIfAborted();
  validateMap(next);
  let assets=files || record;
  if(!assets) {
    const blobs=await Promise.all([source.image,source.thumbnail].map(async path=>{
      const response=await fetchAsset(path,{signal});
      if(!response.ok)throw new Error('Could not copy the map image. Retry when the map is available.');
      return response.blob();
    }));
    assets={image:blobs[0],thumbnail:blobs[1]};
  }
  signal?.throwIfAborted();
  const map=variationModel(next,source);
  map.settlementSettings=normalizeSettings(map,settings);
  // Each regeneration is a separate map. Restore returns to this new copy's starting state.
  return save(map,assets.image,assets.thumbnail,map,{create:true});
}
