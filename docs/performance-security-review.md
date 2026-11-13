# Performance and security review

Reviewed 2026-11-12 against main commit `91365df6c718a00bd245c5f31e10aa74cdbeb656`.

Scope: the static Cloudflare Pages app, browser storage, map imports, external API clients, workers, rendering, build output and installed dependencies. This review does not assess the internals of the external content services or Cloudflare account configuration.

## Fixed findings

| Impact | Finding | Change |
| --- | --- | --- |
| High | Opening the collection eagerly imported the real-world importer and both procedural vendor bundles. | Load the importer and upload tools on demand. The initial static module graph drops from 180 files / 3,834,601 bytes to 123 files / 665,975 bytes, about 83% fewer raw JavaScript bytes. |
| High | Full-text search generated thousands of stories on the UI thread. Applying the resulting predicate to map overlays could repeat that generation. | Search an isolated source snapshot in a worker. Cancel superseded jobs and terminate the worker on navigation. Return matching IDs and use set membership for map visibility. |
| High | Four image-sized overlay canvases multiplied bitmap memory. Pointer movement cleared an entire selection canvas even when nothing changed. | Cap each overlay at 4,194,304 pixels and 4096 pixels per side. Preserve image-space coordinates through context transforms. Skip unchanged highlights and release backing stores when destroying a map. |
| High | Imported JSON lacked limits on map dimensions, location counts, nesting and geometry complexity before expensive validation and indexing. | Enforce resource budgets before generation, canvas allocation or indexing. Limit geographic reference depth in either traversal order. Reject ambiguous asset paths containing schemes, controls, encoded traversal or external origins. |
| High | A large polygon was copied into every spatial cell in its bounding box. Repeating such polygons in an import could multiply memory far beyond input size. | Store features spanning more than 64 cells once in a fallback list. Include that list in hit testing and saved indexes. Upgrade existing local indexes in memory. |
| Medium | Every pointer event could rerun map drawing, label layout, tile placement and wizard updates. | Combine draws into one animation frame in the explorer and region selector. Remove a redundant marker-filter pass and use the existing place-ID index. |
| Medium | Preview and explorer reads refetched and reparsed the same map JSON. Concurrent connected-content requests were not shared. | Add a three-entry JSON cache with independent returned copies. Share identical pending requests. Each consumer can cancel independently, and upstream work stops when no consumers remain. |
| Medium | Connected-content JSON was read without a byte ceiling. Cached reads could ignore an already-cancelled caller. | Limit streamed external JSON to 1 MiB, map JSON to 12 MiB, and rendered result counts. Honor cancellation before cache access and during body reading. Retain credential omission, escaped remote text and provider-restricted links. |
| Medium | Map validation rebuilt the same generator catalog for every location. | Reuse one catalog per generator version within each validation call. Released generation algorithms and map content remain unchanged. |
| Medium | CI rejected the committed source archive because recompressing identical source produced different gzip bytes. | Normalize archive metadata and retain the committed gzip encoding only when its decompressed contents exactly match the rebuilt source. Source changes still regenerate the archive. |

## Measured bounds

These figures describe raw source bytes, spatial index references and canvas RGBA backing stores. They are not network transfer measurements or total browser memory measurements.

| Map / case | Before | After |
| --- | --- | --- |
| Initial static JavaScript graph | 3,834,601 bytes | 665,975 bytes |
| Grayhaven: four overlay stores | 96.04 MiB | 63.99 MiB |
| Maximum supported 24 MP map: four overlays | Up to 366.21 MiB | At most 64 MiB |
| Dragonsgate: spatial cell references | 17,967 | 15,416 plus 13 fallback features |
| Grayhaven: spatial cell references | 22,184 | 7,356 plus 46 fallback features |

Overlay downsampling affects only overlay raster detail at high zoom. Map artwork, exported images, coordinates, hit geometry and DOM labels keep their existing resolution and identities.

## Remaining findings, ordered by impact

| Rank | Impact | Area and evidence | Recommended next change |
| --- | --- | --- | --- |
| 1 | Medium | Full-map PDF export generates text and assembles the document on the UI thread. It yields between batches but retains the whole PDF and resolved entries in memory. See `public/js/guide-pdf.js`, `guide-pdf-entries.js` and `pdf-writer.js`. | Move generation to a worker and reduce simultaneous intermediate buffers. Show an estimated page count before very large exports. |
| 2 | Medium | Reading a v2 location name through `materializeMap()` invokes full `resolveLocation()` generation, including content that a map label does not display. New visible labels can therefore cause unnecessary narrative generation. See `public/js/generation/locations.js`, `locations-v2.js` and `map-labels.js`. | Separate and cache identity resolution. Verify all released names and dependent content against existing snapshots before switching getters. |
| 3 | Medium | Import survey conversion still runs on the UI thread. Many wizard input events also redraw all source features and recompute source counts and plan summaries. See `public/js/world-maps/dialog.js`, `source-review.js` and `wizard-summary.js`. | Move survey conversion into the existing generation worker. Cache source grouping and debounce text/style changes so only affected previews update. |
| 4 | Medium | Each save clones the current and initial maps and rebuilds all spatial indexes. Listing maps uses a cursor over full records even though the collection needs only metadata and thumbnails. See `public/js/local-maps/store.js`. | Introduce a metadata store and separate immutable original snapshots. Rebuild spatial indexes only after geometry changes. This requires an IndexedDB migration. |
| 5 | Low to medium | Routing ignores stale result IDs but its synchronous worker keeps processing queued routes after points change. See `public/js/travel/tools.js`, `worker.js` and `graph.js`. | Debounce point changes and keep only the newest pending route. Retain the cached graph unless tolerance or roads change. |
| 6 | Low | Connected-content options persist indefinitely, and every successful grave request serializes the entire snapshot cache to localStorage. See `public/js/integrations/client.js`. | Add option freshness metadata with an offline fallback and combine storage writes from concurrent requests. |
| 7 | Low | Input handlers in the authoring editor schedule a delayed preview and also call the preview routine immediately for changes. Guide and directory “load more” actions reconstruct previously rendered entries. See `public/js/authoring/editor.js`, `guide.js` and `viewer.js`. | Give each form control one preview path. Append new entries rather than replacing already-rendered items. |
| 8 | Low | The CSP omits an explicit `form-action` restriction. Current visitor text is escaped and remote links are restricted to provider origins, so this is defense in depth. See `public/_headers`. | Add `form-action 'self'` after verifying all form workflows against production response headers. |

## Verification

- Baseline: 278 tests passed.
- Updated source: 297 tests passed, including 19 added regression cases.
- Regression coverage: import resource limits, ambiguous URLs, deep reference chains, spatial fallback hits, overlay coordinate transforms, render coalescing, worker cancellation and story matching, request deduplication, independent aborts, body limits, retry recovery and cache isolation.
- Run `npm test` and `npm run build` for the matching source and committed distribution. The build validates both maps, 11,570 locations, JavaScript syntax and the 500-line limit.
- A second production build preserved the distribution and source archive bytes. Packaging regression coverage checks alternate gzip encodings, permission differences, source edits and corrupt archives.
- `npm audit --json` reported zero known vulnerabilities for the installed dependency tree at review time.
- Browser checks covered collection previews, both explorers, zoom, selection, opening the deferred importer, region selection, background search and query clearing. Grayhaven returned 347 quest-board matches and zoom remained usable during search. No app-origin console errors were observed in these checks.
- External service failure and size-limit behavior was tested with controlled responses. A live Overpass request, full real-world generation, maximum-size image import and full-map PDF export were not exercised during browser QA.

The security fixes address client-side resource exhaustion and input validation. No server authentication surface exists in this repository. This review does not establish that the app or its external services are free of other vulnerabilities.
