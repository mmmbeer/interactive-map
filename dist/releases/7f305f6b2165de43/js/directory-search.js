export class DirectorySearch {
  constructor(map,signal,{createWorker=()=>new Worker(new URL('./directory-search-worker.js',import.meta.url),{type:'module'})}={}) {
    this.map=map;this.signal=signal;this.createWorker=createWorker;this.version=0;
    signal.addEventListener('abort',()=>{this.cancel();this.worker?.terminate();this.worker=null;},{once:true});
  }
  cancel() {
    this.pending?.resolve(null);this.pending=null;
    this.worker?.postMessage({id:++this.version});
  }
  query(filters) {
    this.signal.throwIfAborted();this.cancel();
    return new Promise((resolve,reject)=>{
      const id=++this.version;this.pending={resolve,reject};
      try {
        if(!this.worker) {
          this.worker=this.createWorker();this.sent=false;
          this.worker.onmessage=({data})=>{
            if(data.id!==this.version||!this.pending)return;
            const pending=this.pending;this.pending=null;
            data.error?pending.reject(new Error(data.error)):pending.resolve(new Set(data.ids));
          };
          const fail=()=>{
            this.worker?.terminate();this.worker=null;this.pending?.reject(new Error('Search could not run. Edit your search to retry.'));this.pending=null;
          };
          this.worker.onerror=fail;this.worker.onmessageerror=fail;
        }
        this.worker.postMessage({id,filters,...(!this.sent?{map:this.map}:{})});this.sent=true;
      } catch(error) {this.pending=null;this.worker?.terminate();this.worker=null;reject(error);}
    });
  }
}
