export function generateInWorker(raw,options,{signal,onProgress}={}) {
  return runWorker({raw,options},{signal,onProgress});
}
export function regenerateInWorker(map,settings,{signal,onProgress}={}) {
  return runWorker({task:'regenerate',map,settings},{signal,onProgress});
}
function runWorker(message,{signal,onProgress}) {
  return new Promise((resolve,reject)=>{
    signal?.throwIfAborted();
    const worker=new Worker(new URL('./generation-worker.js',import.meta.url),{type:'module'});
    const cleanup=()=>{worker.terminate();signal?.removeEventListener('abort',abort);};
    const abort=()=>{cleanup();reject(signal.reason||new DOMException('Map creation cancelled.','AbortError'));};
    signal?.addEventListener('abort',abort,{once:true});
    worker.onmessage=({data})=>{
      if(data.stage){onProgress?.(data.stage);return;}
      cleanup();data.error?reject(new Error(data.error)):resolve(data.result);
    };
    worker.onerror=event=>{cleanup();reject(new Error(event.message||'Map generation failed. Try a smaller region.'));};
    worker.onmessageerror=()=>{cleanup();reject(new Error('The generated map could not be transferred. Try a smaller region.'));};
    try{worker.postMessage(message);}catch(error){cleanup();reject(error);}
  });
}
