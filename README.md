# The Wandering Atlas

A static interactive map collection for Cloudflare Pages. Dragonsgate uses the supplied city map with 14 bounded districts, 10,030 mapped entries, 1,033 streets and routes, 129 water and terrain features, and 71 highlighted locations. The rebuilt survey uses v2 generation throughout. Compact source records hold geometry, demographics and geographic links. Names, residents, lore and services resolve deterministically in the browser.

See [the Dragonsgate survey](docs/dragonsgate-survey.md) for coverage, assumptions and the repeatable authoring pipeline.

## Run and build

Requires Node.js 22 or newer. There are no third-party runtime or build dependencies.

```sh
npm run dev    # Local preview on port 3000
npm test       # Determinism, inheritance, migration, drafts, shapes, search and escaping
npm run build # Validate source and copy public/ to dist/
```

`dist/` is committed and ready to upload. Rebuild it after changing source. GitHub Actions checks that the committed build matches the source. Every code file must remain at or below 500 lines, enforced during builds.

## Cloudflare Pages

Connect **mmmbeer/interactive-map** in Cloudflare's **Workers & Pages → Create application → Pages → Import an existing Git repository** flow.

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | Repository root |
| Node.js | 22 or newer |

No environment variables, database, server, API key or Pages Functions are required. After the first deployment Cloudflare rebuilds the connected production branch on pushes. `wrangler.toml` also supports `npx wrangler pages deploy dist --project-name interactive-map` when you have Cloudflare credentials locally. Create or connect the Pages project before deploying with Wrangler.

Cloudflare references: [Static HTML](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/) and [Build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/).

## Add another map

See [docs/adding-maps.md](docs/adding-maps.md) for the format and complete workflow. In a future work chat, supply the map image and name and ask to add it to this repository. The agent should follow [AGENTS.md](AGENTS.md). The viewer supports any number of maps and does not need to change for new content.

1. Put optimized images in `public/assets/maps/<id>/`.
2. Create `public/data/maps/<id>.json` using the documented format.
3. Run `node scripts/register-map.mjs <id>` to add or update its index entry.
4. Run `npm test && npm run build` and commit source plus `dist/`.

## Viewer

- Compact map collection with search and a live pan-and-zoom preview.
- Deep twilight interface with tea green, lime, gold and amber accents.
- Animated map navigation, controls and story panels with reduced-motion support.
- Map and place hash links that work on static hosting.
- Desktop hover previews and click-to-open place stories.
- Touch drag, pinch zoom and tap-to-open stories.
- Mouse-wheel zoom, zoom buttons, full-map fit and overview navigation.
- Search across generated names, descriptions, residents, demographics, custom sections, addresses and neighborhoods.
- Location editor with demographic inputs, hit shapes, live preview and separate local variations.
- Map, region, district and location generation settings with weighted demographics.
- Extensible name pools, location types, template tables and content sections.
- Compact JSON import/export, legacy migration and authored text overrides.
- Category and neighborhood filters, highlights and a full directory.
- District boundary overlays with multipart polygons and neighborhood labels.
- Zoom-dependent labels for roads, geography, businesses and residences with collision culling.
- Sea polygons with island exclusions and matching hit testing.
- Individual map/place links, clipboard sharing and a copyable-link fallback.
- Keyboard controls: `/` search, arrows pan, `+`/`-` zoom, `0` fit, Escape close.
- Local assets only. No analytics, remote fonts or external map service.

The source map is an unlabeled raster. Roof footprints and small lanes are approximate at its 948 × 1,659 resolution. Building functions, district names, residents and stories are fictional additions. Some joined structures share a footprint. Building addresses reference saved mapped roads. The original 54 landmark links remain available; ordinary building ids were rebuilt from roof coordinates for the explicitly requested fresh survey.

## Source layout

```text
public/index.html           Collection and viewer entry point
public/js/app.js            Static route handling
public/js/library.js        Map selection, search and interactive previews
public/js/map-stage.js      Pan, zoom, touch, markers and overlays
public/js/viewer.js         Directory, filters, details and sharing
public/js/spatial.js        Shape-aware hit detection and search
public/js/generation/       Versioned generator, naming pools and validation
public/js/authoring/        Location editor, compact export and local drafts
public/js/map-contract.js   Shared browser/build map validator
public/js/places.js         Viewer and place markup
public/js/ui.js             Icons, categories and HTML escaping
public/css/                 Base, map and responsive styles
public/data/maps.json       Collection index
public/data/maps/*.json     Map metadata, geometry, generation inputs and authored overrides
public/assets/maps/         Maps and thumbnails
scripts/                    Build, preview and validation tools
sources/                    Original supplied map, excluded from deployment
```

## Generation and browser edits

See [docs/generation.md](docs/generation.md) for seeds, inheritance, race/culture inputs, custom content and legacy migration. Use **Edit map** to add locations and **Edit location** on a place to update it. Saves create a separate local variation in the collection. Published maps always remain unchanged. Subsequent edits and scale or settlement settings save only to that local variation. Use its atlas backup to move it to another device. Publishing remains a repository authoring workflow outside the browser editor. Generated results are never persisted in map JSON.

The current survey stores more detailed geometry than the original map. Generated stories remain outside the source JSON.

## Browser asset versions

The production build copies JavaScript and CSS into a directory named from a deterministic content hash. The generated HTML loads that release, and relative module imports remain inside it. A change to any runtime dependency changes the release URL. This prevents browsers from mixing an old validator with new modules after deployment. The original asset paths remain as revalidated compatibility aliases. HTML and map data also revalidate. Versioned assets can be cached indefinitely because their URLs change with their contents.

The error screen’s Reload atlas button reloads the document so a tab left open across a deployment can load the current release.

## Reuse the mapping tools

See [mapping-tools.md](docs/mapping-tools.md) for the browser ES-module entry point, geometry, spatial selection, compact authoring, deterministic generation and Python recognition helpers. The source for roof extraction, contour tracing, lane skeletons and route alignment is committed with the map.

## Map layers and site guides

Use **Districts**, **Streets**, **Labels** and **Numbers** independently in the map's upper-right corner. Numbers identify small sites without long name labels. Zoom in to reveal numbers hidden by collision avoidance. The directory and detail panel show the same numbers. Hover outlines geometry. Selecting a site adds a persistent ring and moves to its location with a smooth transition. Reduced-motion settings disable animations.

Choose **Site guide** in the header to read full numbered entries. Export the current directory results, including the active district, category, search and Highlights/All places scope, or choose the entire map. The preview uses two compact columns on desktop and one column on mobile. Each entry includes a cropped map locator, inline facts, a rumor block and a compact demographic row. The desktop number index jumps to entries without leaving the guide. The preview initially loads 30 entries; **Load more entries** expands it. PDF export always includes every entry in the chosen scope, including entries beyond the preview limit.

**Export PDF** creates a real PDF locally in the browser. Full entries use a two-column layout with local map crops and inline field labels. It contains an overview, automatically divided detail map sheets, a linked number index and full descriptions, residents, rumors, services, demographics and custom sections. Numbered map markers and index rows link to entries. Entry links return to the correct map sheet and index position, or open the corresponding interactive site. Unicode fonts are bundled with their license. No PDF service or runtime package is required. **Cancel export** stops a large job. **Save PDF** lets you save the completed file again. **Open PDF** opens it in a PDF viewer.

Site numbers are persisted with each location. The initial assignments preserve the historical ID order. Filtering, zooming, adding and deleting locations do not renumber existing sites. Deleted numbers remain reserved through the map’s next-site-number counter. A complete Dragonsgate guide has thousands of pages. Use district or category filters to produce smaller guides.

The reusable modules are `site-index.js`, `guide-maps.js`, `guide-pdf.js`, `pdf-writer.js` and `pdf-font.js`. PDF generation never writes resolved content back into compact map data.

## Map image quality

Dragonsgate now loads a lossless 948 x 1659 image from the supplied Reddit original. Enlarged pixels use sharp rendering. The **1:1** map control opens the native-resolution view within the map's zoom limits. About this map provides the image dimensions and a direct image link. More close-up detail requires a larger original raster or vector source. See [map-image-quality.md](docs/map-image-quality.md) for source information and the verified lossless conversion helper.

## District fills and selection

The Districts layer adds a mostly transparent color fill to each district. The normal fill is 14% opaque, hover is 20% and the selected neighborhood is 22%. District labels use the same color. Geometry-based adjacency coloring gives Dragonsgate fourteen distinct hues with strong separation between neighboring districts. The palette stays consistent across reloads and district input order.

Districts are the last map hit target. Buildings, visible pins and number badges, streets, water and terrain retain click priority. A district responds only when no other currently clickable object occupies that point. Hidden district layers never respond. An unobstructed district click selects the neighborhood filter and opens its place directory on mobile. Existing search and category filters stay active.


## Distance and route tools

Choose **Measure & route** to mark a straight distance, a multi-point path, or a road route with intermediate stops. Route directions use the mapped street names. Access paths and small joined endpoint gaps are shown with dashed lines. Disconnected roads produce an explanation rather than an invented route.

Use **Set scale** to mark two points and enter a known distance in meters, kilometers, feet or miles. Calibration saves only to a local variation. Uncalibrated artwork shows pixel distances. Calibrated maps also show estimated walking, riding or wagon times with an optional custom speed. Road crossings are assumed to connect. The routes use saved survey geometry and do not include live conditions or elevation.

The expanded stock catalog supplies 100 substantive product variants for each of 31 supported trades. The prior detail catalog remains readable. Current maps and new image uploads select the expanded catalog explicitly.
