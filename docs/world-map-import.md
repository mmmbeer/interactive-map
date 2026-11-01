# Create a map from a real place

Open **Real-world map** in the collection. Pan the world map, scroll or pinch to zoom, or enter latitude and longitude. Example jumps open Edinburgh, Venice and Madison.

1. Choose square, landscape (3:2) or portrait (2:3). The fixed frame marks the exported area.
2. Choose a 2048, 4096 or 4800 pixel long edge. The default is 4096. All formats stay below the existing 24-million-pixel image limit.
3. Adjust the Dragonsgate preset: pale land, black building footprints, blue-gray water and fine woodland symbols. Change land/water/ink colors, road width, tree density, texture or roof details. Original map labels are omitted from the artwork.
4. Select **Create preview**. Only this action downloads feature data. Panning never runs feature queries. Selections must be below 36 km² and contain at least one mapped feature.
5. Download the PNG, download an atlas backup, or **Save and open map**. The backup keeps artwork, exact geometry, source bounds, settings and deterministic generation together. Maps remain on this browser until backed up.

The navigation map offers OpenStreetMap streets and OpenTopoMap terrain. If one provider is unavailable, select the other. Navigation tiles are never included in the exported artwork or bulk downloaded.

## Architecture

Runtime uses browser APIs and ES modules with no framework, map-library dependency, key or backend. `world-view.js` implements a slippy tile viewport with pointer dragging, pinch zoom, wheel zoom, double click and keyboard controls. `geo.js` defines the crop, Web Mercator projection and image clipping.

`source.js` makes a bounded Overpass POST to `https://overpass.private.coffee/api/interpreter`. The provider permits application use without registration. The most recent successful response is cached in memory for style changes. Requests time out and are cancelled when the modal closes. Incomplete results are rejected instead of silently saving partial maps.

`osm.js` stitches multipolygon members and preserves holes. `model.js` converts source geometry directly into the compact atlas schema. Building polygons, clipped road centerlines, water and land all use the same projection as the renderer. Roads have inferred physical widths when source widths are missing. Nearby buildings reference imported roads. Original source names and addresses are not copied into generated text. OSM identifiers remain part of location IDs. The selected bounds and seed determine the generation identity, independently of the new local storage ID.

`coast.js` handles connected coastline segments and islands. Coastlines must form closed rings or connect across the export frame. Incomplete coast chains cannot reliably define a sea area and are skipped. Entirely unmapped offshore selections cannot be imported.

`render.js` draws vectors into a label-free image, with seeded textures and woodland symbols. Full-size exports are rendered at their requested pixel dimensions rather than enlarged from the preview. The atlas model is saved directly, without raster recognition. Distance calibration is approximate ground scale at the selection's central latitude.

## Coverage and review

Building uses and stories are fictional. OSM footprints and land-cover coverage vary by location. Missing buildings and individual trees cannot be recovered from the navigation tiles. Woodland symbols are decorative, procedurally placed within mapped woodland, and do not claim surveyed tree positions. Districts start as one imported area and can be traced in the editor. Review cropped polygons, coastlines and missing features after import.

## Services and attribution

Navigation requests use the browser's normal cache and Referer and request only visible tiles. Never add tile prefetch or offline tile scraping. Links:

- [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/)
- [OpenTopoMap usage and attribution](https://opentopomap.org/about)
- [Overpass by Private.coffee terms and privacy](https://overpass.private.coffee/)
- [OSM copyright and ODbL](https://www.openstreetmap.org/copyright)

Attribution remains visible in navigation and exported artwork. Backups include ODbL and source links. Distributed derived geometry remains subject to ODbL. Keep source-geometry licensing separate from generated story text. For larger traffic, configure an appropriate hosted or self-hosted data service and update the explicit origins in `public/_headers` alongside the service URLs. No API secrets belong in browser code.
