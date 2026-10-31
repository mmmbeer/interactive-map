# Reusable mapping tools

The repository includes the source for the recognition and authoring tools used to rebuild Dragonsgate. The JavaScript tools are dependency-free ES modules. The authored-map recognition pipeline runs in Python. Visitor uploads also have a bounded browser-worker recognition pipeline.

## JavaScript entry point

Import from `public/js/mapping-tools.js` during development, or `js/mapping-tools.js` when serving the built site. Keep the relative `js/` module tree when copying the tools to another project. Retain the repository's MIT license with copied code.

| Capability | Exports | Implementation |
| --- | --- | --- |
| Image-space geometry | `boundsFor`, `contains`, `ringContains`, `distanceToPath` | `public/js/geometry.js` |
| Canvas overlays | `traceShape`, `fillShape` | `public/js/geometry.js` |
| Fast selection | `buildSpatialIndex`, `hitTest` | `public/js/spatial.js` |
| Directory queries | `matches`, `searchPlaces` | `public/js/spatial.js` |
| Map validation | `validateMap`, `categoryKeys` | `public/js/map-contract.js` |
| Districts | `validateDistrictGeometry`, `districtList`, `regionList`, `DistrictLayer` | `public/js/districts.js`, `public/js/generation/config.js` |
| Deterministic content | `materializeMap`, `resolveLocation`, `catalogFor`, `configFor`, `versionFor`, `availableFields` | `public/js/generation/` |
| Seeded sampling | `streams`, `choose`, `distribution`, `integer`, `sample`, `bank`, `words`, `combine` | `public/js/generation/helpers-v2.js` |
| Compact authoring | `newLocation`, `saveLocation`, `serializeMap`, `migrateMap` | `public/js/authoring/model.js` |
| Viewer interactions | `MapStage`, `MapLabels` | `public/js/map-stage.js`, `public/js/map-labels.js` |

Core geometry, validation, generation and authoring functions can run in a browser, Web Worker or Node.js. `traceShape` and `fillShape` take a Canvas 2D context. `MapStage`, `MapLabels` and `DistrictLayer` create DOM elements and require the atlas CSS. These viewer classes use the atlas categories and layout contract. They are source components rather than a standalone UI package.

### Load, select, edit and export

```js
import {
  validateMap, materializeMap, buildSpatialIndex, hitTest,
  newLocation, saveLocation, serializeMap
} from './js/mapping-tools.js';

const response = await fetch('./data/maps/dragonsgate.json');
if (!response.ok) throw new Error('The map could not be loaded.');
let source = await response.json();
validateMap(source);
const view = materializeMap(source);
const index = buildSpatialIndex(view.locations);

// Coordinates refer to the original image, after undoing pan and zoom.
const selected = hitTest(index, view.locations, 307, 179, 1);
console.log(selected?.name);

const place = newLocation(source, 315, 246);
place.district = source.districts[0].id;
place.category = 'home';
place.type = 'home';
source = saveLocation(source, place);
validateMap(source);
const exportedJSON = serializeMap(source);
```

Save the compact `source`, then materialize a new view and rebuild the spatial index after edits. Resolved content uses caches scoped to that source snapshot. Search accepts an `AbortSignal` and a `current()` callback to cancel obsolete queries. `hitTest` supports category/district predicates and a separate predicate for visible pins.

Polygon `holes` exclude islands or courtyards from hit areas and canvas fills. Polylines have an explicit selectable corridor width. Districts carry boundary polygons separately from location geometry. Both use original-image pixels.

## Raster recognition helpers

| Tool | Reusable functionality | Inputs and output |
| --- | --- | --- |
| `scripts/extract-buildings.py` | Basic dark-roof component extraction and fill/aspect filtering | CLI: image path and candidate JSON output path |
| `scripts/dragonsgate/raster.py` | `polygon_mask` | Pillow image size and polygon shapes to NumPy boolean mask |
| Same module | `simplify` | Ordered point path and tolerance to simplified point path |
| Same module | `outline` | Boolean mask to exterior point ring; `all_loops=True` returns all traced rings |
| Same module | `thin` | Boolean corridor mask to Zhang-Suen skeleton |
| Same module | `lane_paths` | Boolean corridor mask to pruned centerline paths, including closed loops |
| `scripts/dragonsgate/routes.py` | `align_routes` | Surveyed waypoints and RGB array; updates routes with paving-aligned geometry and widths |
| `scripts/dragonsgate/rebuild.py` | Complete reference pipeline | Source raster plus authored survey to compact map JSON |

Install the recorded authoring dependencies with:

```sh
python -m pip install -r scripts/dragonsgate/requirements.txt
python scripts/extract-buildings.py sources/dragonsgate.png candidates.json
python scripts/dragonsgate/rebuild.py
```

To reuse the Python helpers in another authoring script, add their directory to Python's import path:

```python
import sys
from pathlib import Path
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path('scripts/dragonsgate').resolve()))
from raster import outline, lane_paths
from routes import align_routes

rgb = np.array(Image.open('map.png').convert('RGB'))
paving = np.min(rgb, axis=2) > 165
paths = lane_paths(paving)
```

The `rebuild.py` entry script includes Dragonsgate's specific masks, thresholds, district assignment, street linking and fictional building-function choices. Use it as a reference when assembling another map. Import `raster.py` and `routes.py` for the reusable numerical functions. Recognition returns candidates and approximations that need visual review. Raster colors cannot establish a building's trade, district jurisdiction or lore.

The visitor upload workflow uses `public/js/local-maps/recognize.js` and `raster.js` for browser recognition. These export connected-component labeling, contour tracing, simplification, Zhang-Suen thinning and branch/loop route tracing. `worker.js` runs the pipeline away from the UI. These color-based candidates need review and do not match the map-specific authored Python surveys. `store.js` persists image Blobs, compact geometry and selection indexes in IndexedDB. The static Cloudflare Pages build continues to load authored JSON and generates text locally.

For the data contract and complete survey workflow, see [adding-maps.md](adding-maps.md), [generation.md](generation.md) and [dragonsgate-survey.md](dragonsgate-survey.md).

## Numbered guides and PDF export

Import `siteNumbers` to assign the same ID-based numbering in an editor, directory and map overlay. Pass the complete location list once and retain its `Map<id, number>` when filtering. `entrySections` supplies the complete reader-facing fields, including custom sections. Neither helper changes the source map.

`StreetLayer` and `NumberLayer` render the independently controlled overlays used by `MapStage`. `mapSheets(data, places)` partitions dense selections into printable detail maps. Each selected site belongs to exactly one detail sheet.

`createGuidePdf(data, places, options)` returns a Promise of a PDF Blob. Pass materialized data and the chosen subset. Options accept an embedded JPEG map (`{width, height, bytes}`), two `PdfFont` instances or browser-loaded bundled fonts, an optional `baseURL` for interactive map links, an `AbortSignal`, and `onProgress(text)`. `mapImage(image, signal)` converts a loaded browser map image to that JPEG representation. Include `assets/fonts/` and its license in another mapper, or pass compatible normal and bold TrueType buffers through `PdfFont`.

The PDF modules use standard browser APIs and do not require a package or backend. Text stays selectable and Unicode-mapped. The generator creates named destinations for map sheets, index rows and full entries. Page content is compressed where `CompressionStream` is available. The full map raster is embedded once and reused by clipping it for each detail sheet.

`guideCrop(place)` computes the shared local map crop used in compact browser entries and PDF entries. `guideEntryHTML(place, number, map)` renders the escaped, complete browser entry with the same site number, locator, facts and custom sections. The PDF entry layout uses two columns and supports continued entries without dropping text or return links.

## District palettes and fallback interaction

`districtAdjacency(districts)` constructs a graph from polygon contacts, overlaps and near boundaries. `districtColors(districts)` first assigns distinct hues while enforcing contrast across graph edges. For graphs that cannot use that assignment within the search budget, it uses contrasting color families and unique shades. Adjacent Dragonsgate districts differ by at least 60 degrees of hue. Both helpers use geometry and stable IDs without resolving location text or changing source data.

`hitTestDistrict(districts, x, y, {enabled, object})` returns a containing district only when the layer is enabled and `object` is absent. Pass the result of the regular location hit test as `object` to retain object priority. Multipart districts and polygon holes are supported. `MapStage` exposes `selectDistrict` and `hoverDistrict` callbacks separately from location callbacks, so district selection does not create a synthetic place or alter shared location URLs.
