// Reusable browser ES modules for a mapper/editor. See docs/mapping-tools.md.
// Import the full relative module tree; this file does not require a server API.
export { boundsFor, contains, ringContains, distanceToPath, traceShape, fillShape } from './geometry.js';
export { buildSpatialIndex, hitTest, matches, searchPlaces } from './spatial.js';
export { validateMap, categoryKeys } from './map-contract.js';
export { validateDistrictGeometry, DistrictLayer } from './districts.js';
export { materializeMap, resolveLocation } from './generation/locations.js';
export { catalogFor, configFor, districtList, regionList, availableFields, versionFor } from './generation/config.js';
export { streams, choose, distribution, integer, sample, bank, words, combine } from './generation/helpers-v2.js';
export { migrateMap, serializeMap, newLocation, saveLocation } from './authoring/model.js';
export { MapStage } from './map-stage.js';
export { MapLabels } from './map-labels.js';
