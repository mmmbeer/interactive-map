// Identical requests share work. Each caller retains independent cancellation.
export function sharedRequest(pending,key,signal,start) {
  signal?.throwIfAborted();
  let flight=pending.get(key);
  if(!flight) {
    flight={controller:new AbortController(),users:0,settled:false};
    pending.set(key,flight);
    flight.promise=Promise.resolve().then(()=>{
      flight.controller.signal.throwIfAborted();return start(flight.controller.signal);
    }).finally(()=>{
      flight.settled=true;
      if(pending.get(key)===flight)pending.delete(key);
    });
  }
  flight.users++;
  return new Promise((resolve,reject)=>{
    let done=false;
    const finish=(callback,value)=>{
      if(done)return;done=true;signal?.removeEventListener('abort',abort);
      if(--flight.users===0&&!flight.settled) {
        if(pending.get(key)===flight)pending.delete(key);
        flight.controller.abort();
      }
      callback(value);
    };
    const abort=()=>finish(reject,signal.reason||new DOMException('Cancelled.','AbortError'));
    signal?.addEventListener('abort',abort,{once:true});
    flight.promise.then(value=>finish(resolve,value),error=>finish(reject,error));
  });
}
