import { convertArea } from './model.js';
import { regenerateLayout } from './regeneration.js';
self.onmessage=({data})=>{
  try {
    const onProgress=stage=>self.postMessage({stage});
    const result=data.task==='regenerate'?regenerateLayout(data.map,data.settings,onProgress):convertArea(data.raw,{...data.options,onProgress});
    self.postMessage({result});
  }catch(error){self.postMessage({error:error.message});}
};
