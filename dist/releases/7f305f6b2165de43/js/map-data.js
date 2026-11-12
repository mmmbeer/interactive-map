import { sharedRequest } from './shared-request.js';
import { responseJSON } from './response-json.js';
const cache=new Map(),pending=new Map();
export async function loadJSON(path,signal) {
  signal?.throwIfAborted();
  if(cache.has(path)) {
    const value=cache.get(path);cache.delete(path);cache.set(path,value);
    return structuredClone(value);
  }
  const value=await sharedRequest(pending,path,signal,async signal=>{
    const combined=AbortSignal.any([signal,AbortSignal.timeout(30000)]);
    const response=await fetch(path,{signal:combined});
    if(!response.ok)throw new Error(`Could not load ${path} (${response.status}).`);
    const data=await responseJSON(response,{signal:combined,maxBytes:12*1024*1024});
    combined.throwIfAborted();cache.set(path,data);
    while(cache.size>3)cache.delete(cache.keys().next().value);
    return data;
  });
  signal?.throwIfAborted();return structuredClone(value);
}
