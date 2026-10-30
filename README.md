# The Wandering Atlas

A static interactive map collection for Cloudflare Pages. The first map is **Dragonsgate**, using the supplied city map, 54 authored landmarks and 7,031 generated building entries. Location JSON stores compact geometry and generation inputs. A versioned, seeded browser generator supplies names, residents, lore, hooks and services. The 54 authored landmarks keep their original text as overrides.

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
- Location editor with demographic inputs, hit shapes, live preview and local drafts.
- Map, region, district and location generation settings with weighted demographics.
- Extensible name pools, location types, template tables and content sections.
- Compact JSON import/export, legacy migration and authored text overrides.
- Category and neighborhood filters, highlights and a full directory.
- Individual map/place links, clipboard sharing and a copyable-link fallback.
- Keyboard controls: `/` search, arrows pan, `+`/`-` zoom, `0` fit, Escape close.
- Local assets only. No analytics, remote fonts or external map service.

The source map is an unlabeled raster. Its black building-like footprints were used as approximate hit areas. These are points of interest, not surveyed building boundaries or original-map lore. Names, inhabitants and story hooks are invented. A generated street address is a directory label, not a labeled street on the drawing. Prominent landmarks have authored descriptions and rumors. Ordinary buildings have shorter generated descriptions. Some tiny or joined structures may share a hit area.

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

See [docs/generation.md](docs/generation.md) for seeds, inheritance, race/culture inputs, custom content and legacy migration. Use **Edit map** to add locations and **Edit location** on a place to update it. Saves create a draft on the current device. Export JSON, register the updated map, rebuild and commit to publish through Cloudflare. Generated results are never persisted in map JSON.

Dragonsgate’s map data dropped from 2,103,891 to about 813,000 bytes while preserving every location id, coordinate, hit box and authored highlight.
