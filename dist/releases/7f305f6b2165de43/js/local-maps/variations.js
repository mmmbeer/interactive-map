import { numberSites } from '../site-index.js';
import { localMapId } from './identity.js';
import { saveLocalMap } from './store.js';
import { saveSettings } from '../generation/settlement-settings.js';

export function variationModel(edited,original,id=localMapId()) {
  const map=numberSites(structuredClone(edited),original);
  return {...map,id,generationId:original.generationId || original.id,
    localVariation:{sourceId:original.id,sourceName:original.name},
    image:`local/${id}/map`,thumbnail:`local/${id}/thumbnail`};
}
export async function saveVariation(edited,original,settings,{signal,fetchAsset=fetch,save=saveLocalMap}={}) {
  const blobs=await Promise.all([original.image,original.thumbnail].map(async path=>{
    const response=await fetchAsset(path,{signal});
    if(!response.ok)throw new Error('Could not copy the map image. Retry when the map is available.');
    return response.blob();
  }));
  if(signal?.aborted)throw new DOMException('Save cancelled.','AbortError');
  const map=variationModel(edited,original);
  if(settings && !map.settlementSettings)map.settlementSettings=settings;
  const initial=variationModel(original,original,map.id);
  const record=await save(map,...blobs,initial,{create:true});
  if(settings)saveSettings(map,settings);
  return record;
}
