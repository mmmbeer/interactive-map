// Reusable browser ES modules for a mapper/editor. See docs/mapping-tools.md.
// Import the full relative module tree; this file does not require a server API.
export { boundsFor, contains, ringContains, distanceToPath, traceShape, fillShape } from './geometry.js';
export { buildSpatialIndex, hitTest, matches, searchPlaces } from './spatial.js';
export { validateMap, categoryKeys } from './map-contract.js';
export { validateDistrictGeometry, hitTestDistrict, DistrictLayer } from './districts.js';
export { materializeMap, resolveLocation } from './generation/locations.js';
export { catalogFor, configFor, districtList, regionList, availableFields, versionFor } from './generation/config.js';
export { streams, choose, distribution, integer, sample, bank, words, combine } from './generation/helpers-v2.js';
export { migrateMap, serializeMap, newLocation, saveLocation } from './authoring/model.js';
export { MapStage } from './map-stage.js';
export { MapLabels } from './map-labels.js';

export { siteNumbers, entrySections, isGeography } from './site-index.js';
export { StreetLayer, NumberLayer } from './map-overlays.js';
export { mapSheets } from './guide-maps.js';
export { createGuidePdf, mapImage } from './guide-pdf.js';
export { PdfDocument, loadPdfFonts } from './pdf-writer.js';
export { PdfFont } from './pdf-font.js';
export { guideCrop, guideEntryHTML } from './guide-entry.js';
export { districtColors, districtAdjacency, districtsAdjacent } from './district-colors.js';
