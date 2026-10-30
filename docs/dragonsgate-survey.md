# Dragonsgate survey

The 2026 rebuild starts from `sources/dragonsgate.png` and the authored survey in `sources/dragonsgate/survey.json`. It replaces the old ordinary building inventory and upgrades every location to generator v2.

| Coverage | Entries |
| --- | ---: |
| Roof footprints | 8,797 |
| Streets, alleys, roads, bridges, squares and pier walks | 1,033 |
| Water features | 5 |
| Islands, woods, fields and cape | 124 |
| Authored building and public-place highlights | 71 |
| Total locations | 10,030 |
| Bounded districts | 14 |

The 71 highlights include the original 54 named landmarks. Their ids remain available. Ordinary roof ids use surveyed pixel coordinates. Adding a separate building does not renumber the rest.

## Coverage and interpretation

- Principal streets, wall walks, country approaches, three canal bridges, three squares and pier decks have explicit survey waypoints. The authoring script aligns them with visible paving.
- Smaller lanes come from connected white corridors between roof footprints. Short spurs, enclosed citadel yards, planted gardens and mapped agricultural plots are excluded. Separate segments meet at junctions. Each segment has a stable id and generated name.
- Filled dark shapes identify approximate roof footprints. Low-fill tree outlines and long linework are rejected. Ordinary building anchors touch a dark roof pixel and lie inside the assigned district. Landmark bounding areas suppress duplicate roof entries.
- Most ordinary buildings are homes. Shops and workshops use specific supported trades. Coastal workshop choices emphasize cooperage, sailmaking, carpentry and metalwork. Building function cannot be read from this unlabeled raster, so these functions are fictional assignments.
- Every building has a saved street reference. Featured places prefer a named surveyed route. Other buildings use the closest mapped lane in their district. Addresses use that road's displayed name.
- Demographics inherit from district and regional defaults. Authored characters have fixed profiles. Ordinary households store a population input. The map's home catalog supplies household naming and prose.
- The sea exterior follows the raster coastline and excludes 134 land rings. Separate water areas name the island harbor, city channel, mainland harbor and eastern canal. The map shows no island-to-mainland bridge, so none is added.
- Land features include the main city island, 105 offshore islets and skerries, seven woods or orchards, ten agricultural areas and the eastern cape. Very small marks below the raster extraction threshold are part of the image rather than separate selectable features.
- Districts divide the island city, mainland neighborhoods, watch islands and rural surroundings. Multiple polygons allow disconnected watch isles and the two sides of the outer countryside.

The source is 948 × 1,659 pixels. Tiny attached roofs can share one footprint. Lane centerlines, geographic outlines and fictional district divisions are approximations, not surveyed property lines. No runtime code infers coordinates or reassigns street references.

## Rebuild

Requires Node.js 22+, Python, Pillow, NumPy and SciPy. Browser visitors need none of these packages.

```sh
python scripts/dragonsgate/rebuild.py
node scripts/register-map.mjs dragonsgate
npm test
npm run build
```

`rebuild.py` reads the image and authored survey, not the previous generated map. It writes compact inputs with deterministic ids. It does not save materialized names or stories for ordinary buildings. The released generator catalogs and RNG remain unchanged.

The authoring modules separate raster tracing, route alignment and map assembly. Each script stays below 500 lines.

## Viewer

Open Dragonsgate to fit the complete map. **Districts** controls boundary overlays and district names. **Labels** controls place pins and labels. Zooming reveals road labels, businesses and then household labels. Labels and pins yield to each other to limit overlap. The directory always includes every mapped entry, including labels hidden at the current zoom.

District filters use metadata without generating every story. Search resolves content in cancellable batches. Selecting a broad geographic feature fits its area. Selecting a building zooms to its neighborhood. The editor preserves polygon exclusions, district boundaries, demographics and geographic references through draft export.
