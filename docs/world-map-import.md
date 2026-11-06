# Create a map from a real place

Open **Real-world map** in the collection. Pan the world map, scroll or pinch to zoom, or enter latitude and longitude. Example jumps open Edinburgh, Venice and Madison.

1. Choose square, landscape (3:2) or portrait (2:3). The fixed frame marks the exported area.
2. Choose a 2048, 4096 or 4800 pixel long edge. The default is 4096. All formats stay below the existing 24-million-pixel image limit.
3. Adjust the Dragonsgate preset: pale land, black building footprints, blue-gray water and hand drawn cartography symbols. Change land/water/ink colors, road width, tree density, texture or roof details. Original map labels are omitted from the artwork.
4. Leave **Map data** on **Prepared map data (recommended)** to avoid public query queues. This source is the March 2026 Protomaps snapshot. Choose **Live OpenStreetMap data** when you need a newer source and the Overpass services are available. Open **2. Settlement** before creating the preview. Only this action downloads feature data. Panning never runs feature queries. Selections must be below 36 km² and contain at least one mapped feature.
5. Select the settlement type. Configure primary and optional secondary ancestry with a percentage, living standards, life-stage mix and optional residents per home. Household size applies to residences, not the whole population. Choose district planning and optional district count. Select requested sites and rural land uses. **Economy and surroundings** can supply an economic focus, resource and environment. Settlement-specific suggestions populate the feature checkboxes. Manual feature choices remain intact until you request suggestions again.
6. Select **Create preview**. Review counts and placement warnings. **Show suggested districts in preview** toggles the planning overlay. Original mapped land uses remain present even if their checkbox is off. Requested inns, markets, guilds, temples and smithies reuse mapped footprints. Harbors need a nearby navigable water feature. Settlement type also weights the remaining mix of homes, shops and workshops. Extra fields, pasture, orchards and burial grounds use clear parcels away from source water, roads, buildings and mapped land uses. Missing space produces a warning instead of an invented building position.
7. Download the PNG, download an atlas backup, or **Save and open map**. The backup keeps artwork, exact geometry, source bounds, settings and deterministic generation together. Maps remain on this browser until backed up.

The navigation map offers OpenStreetMap streets and OpenTopoMap terrain. If one provider is unavailable, select the other. Navigation tiles are never included in the exported artwork or bulk downloaded.

## Architecture

Runtime uses browser APIs and ES modules with no framework, map-library dependency, key or backend. `world-view.js` implements a slippy tile viewport with pointer dragging, pinch zoom, wheel zoom, double click and keyboard controls. `geo.js` defines the crop, Web Mercator projection and image clipping.

`prepared.js` is the default data path. It downloads a spatial cutout from the fixed `https://data.source.coop/protomaps/openstreetmap/v4.pmtiles` archive. The provider lists that snapshot as March 31, 2026. `pmtiles.js` reads only the archive header, relevant directories and zoom-15 vector tiles using HTTP byte ranges. A server returning a whole-file response is rejected before its body is consumed. Imports use at most four concurrent requests, 96 tiles and 20 MiB of transferred bytes, with a 60-second overall deadline and a 15-second per-range deadline. No whole-planet download, background prefetch, map package or backend is required.

`mvt.js` decodes the vector-tile schema directly. `prepared-geometry.js` maps building, road, water and land features to the same compact geometry inputs used by live imports. `tile-seams.js` cancels shared polygon edges to join buildings across tiles and preserve courtyards. Tile buffers are clipped before joining so structures are not duplicated. Prepared snapshots contain curated and sometimes simplified geometry, rather than every OpenStreetMap tag. Individual building detail is read at zoom 15. Snapshot provenance and attribution remain in backups.

The optional live source remains available. `source.js` makes bounded Overpass POSTs to Private.coffee with the main Overpass API as a fallback. Each attempt has a 15-second deadline covering connection, headers, body download and decoding. A stalled first service automatically switches to the second. Network and server errors can fail over; rate limits and oversized responses cannot. The most recently successful service is tried first for subsequent selections. The latest complete result is cached for style changes.

The modal shows elapsed time and received kilobytes. **Cancel** stops a download or render without discarding the selection and settings. Both a caller abort and the deadline explicitly settle the request, even if a browser does not settle its underlying fetch or body reader. Deadlines are checked again when a suspended page resumes. Streamed responses are capped at 12 MiB even without a Content-Length header. Incomplete responses and late replies are never cached. A small area can still be delayed by a public service queue; a smaller crop is not always the remedy.

`osm.js` stitches multipolygon members and preserves holes. `model.js` converts source geometry directly into the compact atlas schema. Building polygons, clipped road centerlines, water and land all use the same projection as the renderer. Roads have inferred physical widths when source widths are missing. Nearby buildings reference imported roads. Building and geographic names are regenerated. Mapped district names are retained only when you choose mapped boundaries. Source addresses are not copied into generated text. OSM identifiers remain part of location IDs. The selected bounds and seed determine the generation identity, independently of the new local storage ID.

`coast.js` handles connected coastline segments and islands. Coastlines must form closed rings or connect across the export frame. Incomplete coast chains cannot reliably define a sea area and are skipped. Entirely unmapped offshore selections cannot be imported.

`render.js` draws vectors into a label-free image, with seeded textures and ink symbols. Full-size exports are rendered at their requested pixel dimensions rather than enlarged from the preview. The atlas model is saved directly, without raster recognition. Distance calibration is approximate ground scale at the selection's central latitude.

### Hand drawn terrain

New imports use locally bundled symbols from [Kenney's Cartography Pack](https://kenney.nl/assets/cartography-pack), released under CC0. The original license and asset provenance are in `public/assets/cartography/`. The export metadata records the symbol source and license separately from OSM geometry. The renderer tints the strokes to the selected ink color. Grass, reeds, subtle land washes and gently uneven crop furrows supplement the pack.

`decoration-plan.js` selects tree variants and places irregular woodland clusters with open glades. Marshes receive reeds, small shrubs and water marks. Cemeteries receive varied burial groups, orchards retain loose rows and pasture receives grass and occasional stones. Sparse grass, shrubs and stones break up unclassified open ground, using the settlement's woodland or wetland environment when supplied. Boats appear only on navigable water near an imported or established harbor. Small ripple groups also decorate open water. These marks are decoration, not surveyed objects or additional searchable locations.

The synthetic terrain sampler below demonstrates the symbols, parcel holes and obstruction handling. It is a renderer review fixture, not a surveyed settlement.

![Ink terrain sampler](world-map-ink-preview.jpg)

The plan uses the import seed, feature IDs and image coordinates. Preview and full-resolution exports share the same placements. Local storage IDs, feature array order and preview size do not affect the plan. `decoration-geometry.js` indexes road, water and building geometry and checks each symbol's complete rotated footprint. Parcel holes, narrow roads, concave boundaries, roofs and the image edges remain clear. Vegetation uses a smaller spacing core so neighboring canopies and grass clumps can overlap into thickets; boats, graves and rocks retain their full separation. Water is painted over terrain so overlapping source land-cover polygons cannot hide rivers. Density zero removes woodland, orchard, park and mapped tree marks while retaining burial, wetland and harbor detail.

`decoration-noise.js` supplies a seeded, continuous field shared across the map. Domain warping bends the sampling coordinates, and three noise scales combine broad groves, smaller clusters and local variations. Nonlinear density filtering leaves clearings and concentrates vegetation in richer patches. The field also groups reeds, meadow details and water ripples, and varies symbol sizes locally. Orchards retain planted rows and burial grounds retain recognizable groups with gentler density variation. Mapped individual trees stay at their source coordinates. Raising tree density adds candidates in the same groves and preserves open glades, including on large parcels that previously hit the attempt cap at every slider setting.

The comparison uses the same synthetic woodland parcel and density setting. The left image shows the earlier distribution; the right shows warped noise and looser canopy spacing.

![Woodland distribution before and after noise filtering](world-map-noise-comparison.jpg)

Placement uses bounded attempts, at most 14,000 symbols, spatial bins and periodic cancellation checks. Symbols load from one same-origin spritesheet and remain safe for PNG and thumbnail export. Existing saved map images and authored Dragonsgate/Grayhaven artwork are retained. Reimport a location to create artwork with the new style.

## Coverage and review

Building uses and stories are fictional. OSM footprints and land-cover coverage vary by location. Missing buildings and individual trees cannot be recovered from the navigation tiles. Woodland symbols are decorative, procedurally placed within mapped woodland, and do not claim surveyed tree positions. Suggested districts use a bounded planning grid with roads as crossing costs and water as barriers. Boundaries follow the selected geography rather than rectangular divisions. A single district can contain disconnected land. Live imports can reuse mapped neighborhood polygons; when those are unavailable the preview reports a fallback to suggested districts. The district count is a target bounded by the available planning cells and buildings. District geometry and household inputs remain editable after saving.

Mapped agricultural land uses retain specific farmland, pasture, orchard or vineyard types through per-map catalogs. Crop rows, grazing marks and orchard symbols distinguish them in the artwork. Cemeteries become searchable burial sites. Nearby buildings link to water and terrain, so resources, occupations and connected quests use their local context. Generated additions record `worldStyle.established`; import preferences and any placement warnings are stored in `worldImport.settlement` and `worldImport.planning`. Review cropped polygons, coastlines and missing features after import.

## Services and attribution

Navigation requests use the browser's normal cache and Referer and request only visible tiles. Never add tile prefetch or offline tile scraping. Links:

- [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/)
- [OpenTopoMap usage and attribution](https://opentopomap.org/about)
- [Overpass by Private.coffee terms and privacy](https://overpass.private.coffee/)
- [Protomaps snapshot and cutout downloads](https://source.coop/protomaps/openstreetmap/v4.pmtiles)
- [PMTiles archive specification](https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md)
- [Protomaps layer schema](https://docs.protomaps.com/basemaps/layers)
- [Main Overpass API usage guidance](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html)
- [OSM copyright and ODbL](https://www.openstreetmap.org/copyright)

Attribution remains visible in navigation and exported artwork. Backups include ODbL and source links. Distributed derived geometry remains subject to ODbL. Keep source-geometry licensing separate from generated story text. For larger traffic, configure an appropriate hosted or self-hosted data service and update the explicit origins in `public/_headers` alongside the service URLs. No API secrets belong in browser code.

## Continuous water features

`water.js` stitches adjoining water polygons even when adjacent source tiles use different IDs. It joins unbranched centerlines and removes centerlines fully covered by riverbank areas. Islands remain exclusions. Distinct water types, named tributaries and disconnected lakes retain their identities. Partial centerline coverage never removes an uncovered reach. The largest source area supplies the surviving location ID, site number and deterministic name. `locationAliases` redirects former fragment IDs and geographic references to that survivor.

Previously saved world imports reconcile water on opening when their water inputs still match the original import. Original images and import snapshots remain intact. Edited water is left for manual review. The next ordinary save persists the repaired geometry and rebuilt indexes. Existing maps do not gain unrequested settlement setup or fictional farmland automatically.
