# Adding a map

Supply a map image, name and setting preferences in a work chat and ask to add it to `mmmbeer/interactive-map`. Maps remain static assets on Cloudflare Pages. Text is generated locally from versioned inputs. No server, API key or AI request is involved.

1. Read `AGENTS.md` and inspect the image. Identify structures, water, landmarks and neighborhoods.
2. Choose a stable lowercase map id. Save the original in `sources/` and optimized images in `public/assets/maps/<id>/`.
3. Copy `docs/map-template.json` to `public/data/maps/<id>.json`. Set exact image dimensions, metadata and attribution.
4. Choose a permanent map seed. Define regions and districts with stable ids and readable names. Districts can reference a region and override its generation settings.
5. Flag recognizable structures with stable location ids, image-pixel anchors, hit shapes, categories, specific types and district ids. Never generate positions at runtime.
6. Configure race, gender, age, naming culture, wealth and population where known. Use weighted defaults for remaining places. See [generation.md](generation.md).
7. Preserve setting-specific names and stories in `overrides`. Use `featured: true` for a manageable number of visible pins. Ordinary buildings usually need no text in the map JSON.
8. Optionally run `scripts/extract-buildings.py` to identify candidate boxes. It needs Pillow, NumPy and SciPy. Inspect candidates visually and remove false positives before adding locations.
9. Run `node scripts/register-map.mjs <id>`, `npm test` and `npm run build`. Inspect hover, tap, search, filters, links and map controls.
10. Commit source, images, map JSON, index and matching `dist/`. Push to the production branch for a connected Cloudflare Pages build.

## Browser authoring

Open **Edit map** to add a place or configure map/district defaults. Open a place and choose **Edit location** to update it. Existing ids are read-only to preserve shared links.

The form provides demographics, category/type, coordinates, shape, highlights, enabled content, overrides and variation. **Place on map** lets you click or tap a point. Pan and zoom while choosing. Press Escape to return without placing. Numeric coordinates support keyboard use. Polygon vertices use an explicit list in the shape field.

The preview uses the viewer's generator. **Save location** stores inputs in a local draft and opens the saved place. **Map & district defaults** edits shared settings as JSON. Apply to the preview, then save defaults.

**Map files & drafts** imports or exports compact map data. **Export saved map JSON** exports the saved draft. **Export current edits** includes unsaved form changes and also works if browser draft storage is full. Imports validate before replacing this map's local draft. They cannot change the map id. An older draft is retained for export when the published map changes. It is not applied over newer published data. Restoring the published map requires the discard checkbox.

To publish browser edits, export `<id>.json`, replace `public/data/maps/<id>.json`, register the map to update counts, test, rebuild, commit and push. Drafts are local to the device. Other visitors see changes after publication.

## Geometry

All coordinates use original displayed-image pixels. The upper-left corner is the origin.

| Shape | Saved representation |
| --- | --- |
| Point | `x`, `y`; default 10 × 10 pixel hit target |
| Rectangle | `bounds: [left, top, width, height]` |
| Ellipse | `shape: {"kind":"ellipse","rx":10,"ry":6}` centered on `x`, `y` |
| Polygon | `shape: {"kind":"polygon","points":[[10,10],[30,10],[20,30]]}` |

Hit testing and overlays use the same shape. Shape extents must remain inside the image. An anchor may sit outside its shape for marker placement. Regions and districts use explicit mappings, not automatic geographic inference.

`docs/map.schema.json` describes the structural contract. The shared browser/build validator also checks bounds, references, weights, tokens, catalog names and type/category compatibility. `initialView` optionally stores an image-pixel center and horizontal span. Asset paths are relative to `public/`.

All map data and templates are public. Do not include private GM notes.


## Name roads, water and terrain

Start new maps with generator version 2 from `docs/map-template.json`. Trace recognizable roads and watercourses with open polyline shapes. Trace lakes, islands, woodland and fields with area shapes. Select a precise type from the `street`, `water` or `terrain` category. Save stable ids and geometry rather than generated names.

Link a building's `context.street` to its mapped road and optionally link water, terrain or a landmark. The editor provides these selectors. Keep the image-space coordinates aligned to visible features. Do not label a peninsula as an island or add a river without a visible watercourse. See `docs/generation.md` for supported types, naming patterns and reference validation.

## District boundaries and polygon exclusions

District objects can include `boundaries`, a nonempty array of image-space polygon shapes, and `label: {"x":300,"y":200}`. Multiple polygons represent separated parts of one district. Keep boundary vertices within the image and assign each building to its actual district. The viewer displays these outlines through the **Districts** control. Map and district defaults in the editor preserve the complete geometry.

Polygon shapes can include `holes`, an array of point rings using the same `[[x,y], ...]` format as the exterior. These rings exclude land from a sea polygon or a courtyard from an area. Exclusions participate in hit testing, drawing, validation and the location editor.

Locations can set `labelMinScale` to delay a small feature's label until a closer zoom. Building labels are automatic at close zoom. They do not need thousands of featured pins. Label culling changes presentation only; every entry remains searchable and selectable through the directory.

## Visitor uploads and local maps

Visitors can select **Upload map** in the collection. PNG, JPEG and WebP images stay on the visitor's browser. No image leaves the device and no AI service or API key is required. IndexedDB stores the original image Blob, a thumbnail, compact map geometry, the original import snapshot and category, district, ID and spatial-cell indexes. New local maps appear first in the collection. Edits rebuild and atomically replace the saved map and indexes.

1. Choose an image and enter a name and deterministic generation seed.
2. Select **Process map**. A module worker analyzes a copy up to 1200 pixels on its longest side. Display and geometry use original-image dimensions. The original image is retained at its uploaded resolution.
3. Review the colored overlay and counts. Click a false match to remove it. For different art styles, sample building, road, water or terrain colors and adjust tolerance or building darkness. Process again to replace the unsaved candidates.
4. Select **Save on this device**. Use the regular directory, district filters, map overlays, numbered guide and location editor.
5. In **Edit map → Map files & drafts**, export an **atlas backup** to include the image, compact geometry and current ancestry/seed. Use **Restore backup** in the upload dialog to reopen it in another browser. Restores preserve map IDs and deterministic names. An existing map with the same ID is never overwritten by a restore.

Recognition is approximate. Dark or red compact components become building candidates. Blue components become water areas. Green components become forest candidates. Bright narrow corridors are skeletonized into road segments. Connected land components separated by roads and water become suggested neighborhoods. Contours retain holes such as islands. Nearby buildings link to roads. Every candidate starts with a stable ID. No random coordinates or random building trades are invented.

Text, roofs, walls, textures and decorations can create false positives. Small features can be missed at the analysis resolution. Monochrome artwork needs color sampling or manual editing. Water candidates default to lake and green areas to forest because pixels cannot establish semantic geography. District boundaries are suggestions, not inferred political boundaries. Correct types, trace missed features and edit district JSON in the existing editor. For an already surveyed map, attach compact map JSON alongside its image to import all annotated roads, districts, geography and locations exactly. The image dimensions must match the JSON.

Images must be under 40 MB and up to 24 million pixels with neither side larger than 8192 pixels. Geometry imports are limited to 10 MB and backups to 60 MB. The processor stops above 12,000 candidates instead of silently truncating its inventory. Browser storage can be full, disabled or cleared. Saving errors keep the upload dialog or editor open. Export backups before clearing site data. A local map link works only in browsers holding that map or its restored backup. It does not publish or transfer the map.
