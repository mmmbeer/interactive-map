// Geometry and stable IDs only: indexing never resolves generated stories.
export const isGeography = p => ['street','water','terrain'].includes(p.category);
export function siteNumbers(locations) {
  const ordered=[...locations].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  const numbers=new Map(),used=new Set();
  for(const p of ordered) if(Number.isSafeInteger(p.siteNumber) && p.siteNumber>0) {
    if(used.has(p.siteNumber))throw new Error('Duplicate site number.');
    numbers.set(p.id,p.siteNumber);used.add(p.siteNumber);
  }
  let next=Math.max(0,...used)+1;
  for(const p of ordered)if(!numbers.has(p.id))numbers.set(p.id,next++);
  return new Map(ordered.map(p=>[p.id,numbers.get(p.id)]));
}
// Persist before editing. The high-water mark reserves numbers of deleted sites.
export function numberSites(map,baseline) {
  const old=baseline ? numberSites(baseline) : null;
  const previous=new Map(old?.locations.map(p=>[p.id,p.siteNumber]) || []);
  if(!baseline && map.nextSiteNumber===undefined && map.locations.every(p=>p.siteNumber===undefined)) {
    const numbers=siteNumbers(map.locations);
    return {...map,locations:map.locations.map(p=>({...p,siteNumber:numbers.get(p.id)})),nextSiteNumber:map.locations.length+1};
  }
  const locations=map.locations.map(p=>({...p,...(previous.has(p.id)?{siteNumber:previous.get(p.id)}:{})}));
  let next=Math.max(map.nextSiteNumber || 1,old?.nextSiteNumber || 1,...locations.map(p=>(p.siteNumber || 0)+1));
  for(const p of locations)if(p.siteNumber===undefined)p.siteNumber=next++;
  return {...map,locations,nextSiteNumber:next};
}
export function entrySections(place) {
  const sections=[['Description',place.description],['A familiar face',place.person],['Word on the street',place.rumor],['Available here',place.services]];
  if(place.demographics) sections.push(['Demographics',Object.entries(place.demographics).map(([k,v])=>`${k}: ${String(v).replaceAll('_',' ')}`).join(' · ')]);
  for(const section of Object.values(place.extra || {})) if(section.text) sections.push([section.label,section.text]);
  return sections.filter(([,text])=>text!==undefined && text!==null && String(text).length);
}
