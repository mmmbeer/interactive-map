const cache=new Map();let cacheBytes=0;
// These are small, user-requested cutouts, never a whole-planet download.
export async function readRange(url,offset,length,{signal,fetcher=globalThis.fetch,onBytes=()=>{},timeoutMs=15000}={}) {
  signal?.throwIfAborted();
  if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(length)||length<1||length>4*1024*1024)throw new Error('Invalid prepared map byte range.');
  const key=`${url}:${offset}:${length}`,cached=cache.get(key);if(cached)return cached;
  const controller=new AbortController();let reader,timer,rejectStop,active=true;
  const stop=new Promise((_,reject)=>{rejectStop=reject;});
  const halt=reason=>{if(active){controller.abort(reason);reader?.cancel().catch(()=>{});rejectStop(reason);}};
  const abort=()=>halt(signal.reason),deadline=Date.now()+timeoutMs;
  const expired=()=>halt(new Error('The prepared map download timed out. Try again.'));
  const resume=()=>{if(Date.now()>=deadline)expired();};
  signal?.addEventListener('abort',abort,{once:true});globalThis.document?.addEventListener('visibilitychange',resume);globalThis.addEventListener?.('pageshow',resume);
  timer=setTimeout(expired,timeoutMs);
  const work=(async()=>{
    const response=await fetcher(url,{headers:{Range:`bytes=${offset}-${offset+length-1}`},signal:controller.signal});controller.signal.throwIfAborted();
    // A 200 here could be the entire 125 GB archive. Reject before reading its body.
    if(response.status!==206)throw new Error(`Prepared map service returned ${response.status}; a partial download is required.`);
    const range=response.headers?.get('content-range');
    if(range&&!range.startsWith(`bytes ${offset}-${offset+length-1}/`))throw new Error('The prepared map service returned the wrong byte range.');
    const parts=[];let total=0;
    if(response.body?.getReader) {
      reader=response.body.getReader();
      try {while(true){const {value,done}=await reader.read();controller.signal.throwIfAborted();if(done)break;total+=value.length;if(total>length)throw new Error('The prepared map download exceeded its requested range.');parts.push(value);if(active)onBytes(value.length);}}
      finally{reader.releaseLock();}
    } else {const bytes=new Uint8Array(await response.arrayBuffer());total=bytes.length;parts.push(bytes);if(active)onBytes(total);}
    controller.signal.throwIfAborted();if(total!==length)throw new Error('The prepared map download was incomplete.');
    const result=new Uint8Array(total);let pos=0;for(const part of parts){result.set(part,pos);pos+=part.length;}return result;
  })();
  try {
    const result=await Promise.race([work,stop]);signal?.throwIfAborted();
    while(cache.size&&cacheBytes+result.length>8*1024*1024){const oldest=cache.keys().next().value;cacheBytes-=cache.get(oldest).length;cache.delete(oldest);}
    cache.set(key,result);cacheBytes+=result.length;return result;
  } finally {active=false;controller.abort();clearTimeout(timer);signal?.removeEventListener('abort',abort);globalThis.document?.removeEventListener('visibilitychange',resume);globalThis.removeEventListener?.('pageshow',resume);}
}
