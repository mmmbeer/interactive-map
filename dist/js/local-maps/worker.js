import { recognizeMap } from './recognize.js';
self.onmessage=({data})=>{
  try {
    const map=recognizeMap(data,message=>self.postMessage({progress:message}));
    self.postMessage({map});
  } catch(error) {self.postMessage({error:error.message});}
};
