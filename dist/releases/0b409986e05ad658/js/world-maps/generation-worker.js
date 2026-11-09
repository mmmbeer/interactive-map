import { convertArea } from './model.js';
self.onmessage=({data})=>{
  try {
    const result=convertArea(data.raw,{...data.options,onProgress:stage=>self.postMessage({stage})});
    self.postMessage({result});
  }catch(error){self.postMessage({error:error.message});}
};
