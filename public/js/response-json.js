// Read decoded bytes so compressed or unadvertised bodies cannot evade the limit.
export async function responseJSON(response,{signal,maxBytes=1024*1024}={}) {
  signal?.throwIfAborted();
  const tooLarge=()=>new Error('The service response is too large. Try a smaller request.');
  if(Number(response.headers?.get('content-length'))>maxBytes) {
    await response.body?.cancel().catch(()=>{});throw tooLarge();
  }
  if(!response.body?.getReader) {
    // Compatibility for fetch adapters. Native browser responses use the bounded stream.
    const value=await response.json();signal?.throwIfAborted();
    if(new TextEncoder().encode(JSON.stringify(value)).length>maxBytes)throw tooLarge();
    return value;
  }
  const reader=response.body.getReader(),parts=[],decoder=new TextDecoder();let bytes=0;
  const abort=()=>reader.cancel().catch(()=>{});
  signal?.addEventListener('abort',abort,{once:true});
  try {
    while(true) {
      const {value,done}=await reader.read();signal?.throwIfAborted();if(done)break;
      bytes+=value.byteLength;if(bytes>maxBytes)throw tooLarge();
      parts.push(decoder.decode(value,{stream:true}));
    }
    parts.push(decoder.decode());return JSON.parse(parts.join(''));
  } finally {signal?.removeEventListener('abort',abort);await reader.cancel().catch(()=>{});reader.releaseLock();}
}
