// Geometry and stable IDs only: indexing never resolves generated stories.
export const isGeography = p => ['street','water','terrain'].includes(p.category);
export function siteNumbers(locations) {
  return new Map([...locations].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0).map((p,i)=>[p.id,i+1]));
}
export function entrySections(place) {
  const sections=[['Description',place.description],['A familiar face',place.person],['Word on the street',place.rumor],['Available here',place.services]];
  if(place.demographics) sections.push(['Demographics',Object.entries(place.demographics).map(([k,v])=>`${k}: ${String(v).replaceAll('_',' ')}`).join(' · ')]);
  for(const section of Object.values(place.extra || {})) if(section.text) sections.push([section.label,section.text]);
  return sections.filter(([,text])=>text!==undefined && text!==null && String(text).length);
}
