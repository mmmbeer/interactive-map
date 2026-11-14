import { indexFacts } from './facts.js';
import { buildHouseholds } from './households.js';
import { buildConnections } from './relationships.js';
import { socialEnabled } from './sections.js';
const graphs=new WeakMap();
// Four phases: compact facts -> capacity/identity matching -> shared incidents ->
// lazy presentation. Presentation never participates in matching or story truth.
export function socialGraph(map) {
  if(!socialEnabled(map))return null;
  if(!graphs.has(map)) {
    const facts=indexFacts(map),census=buildHouseholds(map,facts);
    const connections=buildConnections(map,facts,census);
    graphs.set(map,{facts,...census,...connections,storyCache:new Map(),labelCache:new Map()});
  }
  return graphs.get(map);
}
export function clearSocialGraph(map) {graphs.delete(map);}
export function residentAt(map,placeId) {return socialGraph(map)?.primaryFor(placeId) || null;}
export function householdAt(map,homeId) {
  const graph=socialGraph(map),home=graph?.homes.get(homeId);return home ? {...home,members:graph.membersFor(homeId)} : null;
}
export function storiesAt(map,placeId) {const g=socialGraph(map);return (g?.atSite.get(placeId) || []).map(id=>g.links.get(id));}
