import { configFor, catalogFor } from '../config.js';
import { economicContext, chooseTrade } from '../economy-context.js';
import { participates } from './sections.js';
import { baseIdentity, primaryDemographics } from './identity.js';
import { hash, compare } from './helpers.js';
// Pass 1 indexes compact inputs. Identities and trade profiles are lazy and cached.
export function indexFacts(map) {
  const facts=new Map(),catalogs=new Map();
  const catalogForVersion=p=>{const v=p.generation?.version ?? map.generator.version;if(!catalogs.has(v))catalogs.set(v,catalogFor(map,p));return catalogs.get(v);};
  for(const p of map.locations) {
    if(!['home','shop','workshop','tavern','guild','temple','harbor'].includes(p.category))continue;
    const {config,district,region}=configFor(map,p);if(!participates(map,p,config))continue;
    let identity,demographics,trade,context,ready=false;
    const fact={id:p.id,place:p,config,district:district?.id || p.district,region:region?.id || '',rank:hash(p.id),
      demographics:()=>demographics ||= primaryDemographics(map,p,config),
      identity:()=>identity ||= baseIdentity(map,p,config,catalogForVersion(p),fact.demographics()),catalog:()=>catalogForVersion(p),
      economy:()=>{if(!ready){context=economicContext(map,p,config,fact.demographics());trade=chooseTrade(map,p,config,context);ready=true;}return {context,trade};}};
    facts.set(p.id,fact);
  }
  return new Map([...facts].sort(([a],[b])=>compare(a,b)));
}
