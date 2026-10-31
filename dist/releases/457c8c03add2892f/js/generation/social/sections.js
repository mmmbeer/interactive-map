const categories=['home','shop','workshop','tavern','guild','temple','harbor'];
export const socialSections={
  residents:{label:'Residents and workplaces',templates:['{residentNote}'],categories},
  connections:{label:'Connected stories',templates:['{connectionNote}'],categories},
  requests:{label:'Requests and leads',templates:['{requestNote}'],categories}
};
export const socialTokens=['residentNote','connectionNote','requestNote'];
export const socialEnabled=map=>map.generator?.socialVersion===1;
export const participates=(map,place,config)=>socialEnabled(map) && categories.includes(place.category) && config.social?.enabled!==false;
