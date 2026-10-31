import { detailSources } from './detail-sources-v1.js';
import { expandedStockSources } from './stock-items-v2.js';
import { proseEnabled } from './prose/settings.js';
import { profileDetailSources } from './prose/detail-sources.js';
const expanded={...detailSources,...expandedStockSources};
export const detailSourcesFor=(map,context)=>{
  const base=map.generator?.detailsVersion===2 ? expanded : detailSources;
  return proseEnabled(map)?{...base,...profileDetailSources(context)}:base;
};
