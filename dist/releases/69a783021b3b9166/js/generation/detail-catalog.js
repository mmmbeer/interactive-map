import { detailSources } from './detail-sources-v1.js';
import { expandedStockSources } from './stock-items-v2.js';
const expanded={...detailSources,...expandedStockSources};
export const detailSourcesFor=map=>map.generator?.detailsVersion===2 ? expanded : detailSources;
