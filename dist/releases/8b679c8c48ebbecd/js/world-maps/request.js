export class MapRequestError extends Error {
  constructor(message,{retryable=false,status=0}={}) {super(message);this.name='MapRequestError';this.retryable=retryable;this.status=status;}
}
const cancelled=signal=>signal?.reason||new DOMException('Map creation cancelled.','AbortError');
const MAX_BYTES=12*1024*1024;

// Race the entire response, including its body, against cancellation and a deadline.
// Some mobile fetch implementations do not settle promptly when only aborted.
export async function requestMapData(url,query,{signal,timeoutMs=15000,onProgress=()=>{},fetcher=globalThis.fetch,maxBytes=MAX_BYTES}={}) {
  if(signal?.aborted)throw cancelled(signal);
  const controller=new AbortController(),deadline=Date.now()+timeoutMs;
  let reader,timer,active=true,rejectStop;
  const stop=new Promise((_,reject)=>{rejectStop=reject;});
  const halt=error=>{
    if(!active)return;
    controller.abort(error);reader?.cancel().catch(()=>{});rejectStop(error);
  };
  const expire=()=>halt(new MapRequestError('The map service took too long to respond.',{retryable:true}));
  const checkDeadline=()=>{if(Date.now()>=deadline)expire();};
  const abort=()=>halt(cancelled(signal));
  signal?.addEventListener('abort',abort,{once:true});
  globalThis.document?.addEventListener('visibilitychange',checkDeadline);
  globalThis.addEventListener?.('pageshow',checkDeadline);
  timer=setTimeout(expire,timeoutMs);
  const report=progress=>{if(active&&!controller.signal.aborted)onProgress(progress);};
  const work=(async()=>{
    report({stage:'waiting',bytes:0});
    const response=await fetcher(url,{method:'POST',body:new URLSearchParams({data:query}),signal:controller.signal});
    controller.signal.throwIfAborted();
    if(!response.ok)throw new MapRequestError(response.status===429?'The map service is busy. Wait a minute before trying again.':`The map service returned ${response.status}.`,{status:response.status,retryable:response.status>=500||response.status===408});
    if(Number(response.headers?.get('content-length'))>maxBytes)throw new MapRequestError('This area contains unusually large map records. Try a different selection.');
    let data;
    if(response.body?.getReader) {
      reader=response.body.getReader();const decoder=new TextDecoder(),parts=[];let bytes=0;
      try {
        while(true) {
          const {value,done}=await reader.read();controller.signal.throwIfAborted();if(done)break;
          bytes+=value.byteLength;
          if(bytes>maxBytes){reader.cancel().catch(()=>{});throw new MapRequestError('This area contains unusually large map records. Try a different selection.');}
          parts.push(decoder.decode(value,{stream:true}));report({stage:'receiving',bytes});
        }
        parts.push(decoder.decode());
        try {data=JSON.parse(parts.join(''));}catch {throw new MapRequestError('The map service returned an unreadable response.',{retryable:true});}
      } finally {reader.releaseLock();}
    } else {
      try {data=await response.json();}catch(e){controller.signal.throwIfAborted();throw new MapRequestError('The map service returned an unreadable response.',{retryable:true});}
    }
    controller.signal.throwIfAborted();
    if(data.remark)throw new MapRequestError('The map service could not return the complete area.',{retryable:true});
    if(!Array.isArray(data.elements)||data.elements.length>30000)throw new MapRequestError('This area has too many features. Select a smaller area.');
    return data;
  })();
  try {return await Promise.race([work,stop]);}
  finally {
    active=false;controller.abort();clearTimeout(timer);signal?.removeEventListener('abort',abort);
    globalThis.document?.removeEventListener('visibilitychange',checkDeadline);
    globalThis.removeEventListener?.('pageshow',checkDeadline);
  }
}
