# Adding a map from a work chat

Give the agent a map image, a name and any preferred setting or tone. Ask it to add the map to `mmmbeer/interactive-map`. All authoring happens in the repository. Visitors only browse the finished maps.

## Authoring workflow

1. Read `AGENTS.md` and inspect the supplied map. Identify city boundaries, water, buildings, landmark structures and neighborhoods.
2. Choose a unique lowercase map id, such as `mistwood`. Never rename an existing id.
3. Preserve the original in `sources/<id>.<extension>`. Save a web-optimized image and a smaller thumbnail in `public/assets/maps/<id>/`. Keep source coordinates aligned to the displayed image dimensions.
4. Copy `docs/map-template.json` to `public/data/maps/<id>.json`. Fill in metadata and dimensions. Coordinates and bounding boxes are in **original displayed-image pixels**, not percentages or viewport pixels.
5. Author named locations. Include clear landmarks and useful everyday destinations. Ground the location in what is drawn. Assign categories and neighborhoods. Use original fiction unless setting details are provided.
6. If the map has many buildings, use `scripts/extract-buildings.py` as an optional starting point for approximate hit boxes. It requires Python with Pillow, NumPy and SciPy. Inspect its output. It cannot reliably distinguish buildings, rocks, trees or connected walls. Remove false positives and manually place missing landmarks before creating content. This is an authoring tool and is never run by Cloudflare or visitors.
7. Add a stable unique id, a name, category, district and description to each location. Ordinary places can use one-time seeded generation during authoring. Store the result in JSON. Add `featured: true` to a manageable selection of landmarks for the initial directory and visible pins. Richer entries can include a resident and rumor.
8. Run `node scripts/register-map.mjs <id>`. This validates the map and updates its collection index entry, including counts.
9. Run `npm test` and `npm run build`. Inspect desktop and mobile. Open the map, hover a building, select a place, search and filter, zoom and pan, follow a place link, return to the collection and switch maps.
10. Commit source, images, JSON and the rebuilt `dist/` together. Push to the production branch to trigger a connected Cloudflare Pages deployment.

## Map data

`docs/map.schema.json` defines the format. The build validates the main structural constraints without an external schema library.

| Field | Meaning |
| --- | --- |
| `id` | Stable unique lowercase slug. Used in `#map/<id>` links. |
| `name`, `subtitle`, `description` | Visible map identity and introduction. |
| `image`, `thumbnail` | Local paths relative to `public/`, without a leading slash. |
| `width`, `height` | Exact dimensions of the displayed full-size map in pixels. |
| `theme`, `region`, `tags` | Collection card metadata. |
| `credit` | Map attribution and note about invented content. Preserve known attribution. |
| `initialView` | Optional `{ "x": 474, "y": 342, "width": 860 }`. Center and visible horizontal span in image pixels. Omit to initially fit the entire map. |
| `districts` | Optional list of neighborhood names. Every location's district must be listed. If omitted, the viewer derives it. |
| `locations` | Complete authored list of places. |

## Location data

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | Yes | Stable unique slug within the map, used in share links. |
| `name` | Yes | Place name. |
| `category` | Yes | `landmark`, `tavern`, `shop`, `workshop`, `temple`, `guild`, `harbor` or `home`. |
| `x`, `y` | Yes | Anchor point in image pixels. Origin is the upper-left corner. |
| `bounds` | No | `[left, top, width, height]` of the building hit area in image pixels. Keep it inside the image. If omitted, the point receives a 10×10 pixel hit area. |
| `district` | Yes | Neighborhood or regional grouping. |
| `description` | Yes | Visible description. Plain text only. |
| `person` | No | Resident, proprietor or contact. |
| `address` | No | Directory address. Avoid claiming generated addresses are marked on the original drawing. |
| `rumor` | No | Public story hook. Do not put private GM notes here. |
| `featured` | No | `true` adds a visible marker and includes the entry under Highlights. |

Everything in this repository's map data is public. The source includes no separate private notes or player/GM permissions.

When editing an existing place, preserve its id. When updating the index, preserve the order of existing maps unless asked to reorder them. New maps append to the collection. The first entry supplies the landing page's featured image and title.
