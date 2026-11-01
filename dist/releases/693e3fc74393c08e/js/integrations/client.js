import { providers } from './config.js';
import { requestIdentity } from './requests.js';
const storageKey='wandering-atlas:connected-content:v1';
export function validateResponse(kind,data) {
  const fail=()=>{throw new Error('The content service returned an incomplete response. Retry in a moment.');};
  if(data?.apiVersion!=='1')fail();
  const links=value=>value && typeof value.player==='string';
  if(kind==='quests') {
    if(typeof data.key!=='string' || !links(data.links) || !Array.isArray(data.quests) || !data.quests.length ||
      !data.quests.every(q=>typeof q.title==='string' && typeof q.body==='string' && links(q.links)))fail();
  } else if(!Array.isArray(data.items) || data.items.length!==1 || !data.items.every(i=>typeof i.npc?.name==='string' &&
    typeof i.story?.scene==='string' && Array.isArray(i.story.findings) && i.story.findings.every(f=>typeof f.label==='string' && typeof f.text==='string') && links(i.links)))fail();
  return data;
}
export class ContentClient {
  constructor({fetcher=globalThis.fetch,storage}={}) {
    this.fetcher=fetcher;this.options=new Map();this.cache=new Map();
    try {
      this.storage=storage ?? globalThis.localStorage;
      const saved=JSON.parse(this.storage?.getItem(storageKey) || '{}');
      if(Array.isArray(saved.cache))for(const [key,value] of saved.cache.slice(-8))this.cache.set(key,value);
      if(Array.isArray(saved.options))for(const [kind,data] of saved.options)if(Object.hasOwn(providers,kind) && data?.apiVersion==='1')this.options.set(kind,data);
    } catch { /* Storage is optional, including private browsing and a full device. */ }
  }
  persist() {
    try {this.storage?.setItem(storageKey,JSON.stringify({options:[...this.options],cache:[...this.cache]}));}catch{/* Keep in-memory content if snapshots cannot be saved. */}
  }
  async json(kind,path,{body,signal}={}) {
    const timeout=AbortSignal.timeout(20000),combined=signal?AbortSignal.any([signal,timeout]):timeout;
    try {
      const response=await this.fetcher(providers[kind].origin+'/api/v1/'+path,{signal:combined,credentials:'omit',
        ...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
      const data=await response.json();
      if(!response.ok)throw new Error(typeof data?.error?.message==='string'?data.error.message:`Service returned ${response.status}.`);
      return data;
    } catch(error) {
      if(signal?.aborted)throw error;
      throw new Error(`${providers[kind].name}: ${timeout.aborted?'The request timed out.':error.message || 'Could not connect.'} You can retry without changing this location’s content.`);
    }
  }
  async getOptions(kind,signal) {
    if(this.options.has(kind))return this.options.get(kind);
    const data=await this.json(kind,'options',{signal});
    if(data?.apiVersion!=='1' || !(kind==='quests'?Array.isArray(data.locations):Array.isArray(data.races)))throw new Error('The service options are unavailable. Retry in a moment.');
    this.options.set(kind,data);this.persist();return data;
  }
  async generate(kind,input,signal) {
    const key=requestIdentity(kind,input);
    if(this.cache.has(key)) {
      try {return validateResponse(kind,this.cache.get(key));}catch{this.cache.delete(key);}
    }
    const data=validateResponse(kind,await this.json(kind,kind==='quests'?'boards':'sorrows',{body:input,signal}));
    if(signal?.aborted)throw new DOMException('Cancelled.','AbortError');
    this.cache.set(key,data);
    while(this.cache.size>8)this.cache.delete(this.cache.keys().next().value);
    this.persist();
    return data;
  }
}
export function safeLink(kind,value) {
  try {const url=new URL(value);return url.origin===providers[kind].origin && url.protocol==='https:' && !url.username && !url.password?url.href:null;}catch{return null;}
}
