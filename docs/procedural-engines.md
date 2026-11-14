# Procedural map engines, layout version 4

New regional imports use layout 4. Saved maps retain their authored geometry.
`convertArea(raw, {...options, layoutVersion: 3})` replays the released planner.
The content naming versions and their random streams are unchanged.

## Integrated code

| Upstream | Pin | Executed capabilities |
| --- | --- | --- |
| Red Blob Games Mapgen4 | c1d8cb018a11a8b9e17d59233c36c176429d37eb | Dual mesh, mountain distance, multiscale elevation, prevailing wind, humidity, evaporation, rain shadow, rainfall and accumulated river flow |
| SettleMaker | npm 4.0.0, integrity in package-lock.json | Medieval physical village/city planner, approach roads, serviced blocks, residential demand and capacity, compound footprints, greens, crofts and fields |
| ProbableTrain MapGenerator | f487e4cee321d105d5b0e14258363fa8b4d004ef | Original Grid/Radial basis fields, tensor algebra and directional sampling used in constrained host street routing |
| JSTS, polygon-clipping, d3-delaunay, Poisson sampling, simplex noise, earcut | Exact package pins | Topology, buffers, parcel operations, irregular samples and decomposition of water around island holes |

This is not the complete ProbableTrain application or its American-city presets.
SettleMaker is a TypeScript descendant of Watabou's generator; the old Haxe
application is not bundled. Its host-independent city block solver is also
executed when existing streets prevent using its complete settlement plan.

## Pipeline

1. Read the authoritative retained geometry and layer choices.
2. Build Mapgen4's closed dual mesh over seeded irregular samples. Supply a land
   mask, then run the upstream elevation, rainfall and river-flow methods.
3. Trace the upstream drainage tree and preserve a strictly descending conditioned
   profile. Render tributaries into existing water without replacing its shape.
4. Select dry founding ground and growth centers.
5. For a completely generated road/building layer, call SettleMaker's physical
   planner with local metre coordinates, population demand and water exclusions.
   Filled water holes are triangulated with earcut, preserving islands exactly.
   Ground outside the selected map is unavailable to the physical planner.
6. When a retained road, building or land-use parcel exists, retain the source graph and sample
   ProbableTrain tensor fields in the host's constrained routing. Generate only
   missing road classes. Fit each host frontage plot with SettleMaker's block
   solver rather than scattering independent rectangles.
7. Node intersections and dissolve shared spans using JSTS. Repair short
   disconnected upstream entrances only when both terrain and proposed buildings
   leave a clear corridor. Add narrow service links through occupied blocks.
8. Accept physical building footprints inside dry ground. The host applies a
   12 cm inset to remove coincident-boundary slivers. Detached roof wing cuts
   remain inside the upstream envelope and do not move buildings or enlarge them.
   Minimum footprint area is 5 square metres, independent of the map's drawing
   scale and export dimensions. Area rejections are counted separately from
   footprints rejected for crossing the land boundary.
9. Independently audit actual footprint collisions, then prune unused generated
   routes. Keep mapped geometry and its identifiers intact.
10. Use native settlement greens and fields. If native fields do not fit the
    cutout, use SettleMaker's convex land subdivision and clip it to usable land.
    Requested rural parcels reserve suitable ground before woodland. Climate drives
    woodland on the remainder; host context rules select rural uses.
11. Persist engine pins, recipe, climate arrays, exact graph and geometry,
    upstream diagnostics and accepted capacity. Generate names and stories later.

The host still owns layer retention, terrain constraints, bridges, topology,
access validation, roof ink treatment, context and rendering. Integrating an
upstream generator does not make its proposed output authoritative over source
features or remove the need for these validation passes.

## Replay

The contract is the same source geometry, normalized bounds, seed, profile,
physical distance scale, layout version and pinned dependencies. Random streams
are independent. No generation pass uses the clock or global Math.random.
Metric input rounding and mesh normalization prevent export dimensions from
changing physical placement. Zoom and image export read saved geometry.

Optional profile input:

```js
settlement: {
  type: 'village',
  procedural: { raininess: 0.9, windAngle: 90 }
}
```

Raininess is 0.2 to 2. Wind angle is a flow direction in degrees, clockwise on
screen from east. Null chooses the direction from the seed. The wizard labels
it as the direction the wind comes from. Retained water is never regenerated
when these controls change. Regeneration requires an explicit new preview.

Regional imports default to rebuilding roads, buildings and content in the
regeneration dialog. Names-only regeneration explicitly keeps the layout fixed.
Changing the settlement type on a reinterpreted geographic shape reapplies its
fantasy distance scale; real-distance imports keep their existing calibration.
The preview lists actual buildings, homes, businesses, road segments and alleys
separately, with a building target and a warning when fewer than 60% fit.

## Limits and diagnostics

The physical engine does not accept a complete locked street network. That case
uses its block solver with the host graph, not a translated or distorted whole
city. Conservative building envelopes can be rejected near water or a cutout
edge. Upstream allocation and accepted-map allocation are saved separately;
a proposal that was clipped away does not count as accommodated population.

Terrain starts from generated constraints, not a DEM. Mapgen4 simulates climate
and drainage; it does not perform long-term hydraulic erosion. A retained
watercourse can differ from the synthetic drainage tree. Capacity and separate
street networks are reported rather than hidden by placing houses in water.

## Build, source and licenses

Run `npm ci`, `npm test`, then `npm run build`. Everything runs locally in the
existing cancellable generation worker. No generation-time CDN or remote
settlement service is used. Scripts stay below 500 lines; large upstream artwork
and engines are bundled with esbuild.

SettleMaker is GPL-3.0-only. The combined procedural-engine distribution carries
GPL-3.0 terms. Original MIT, Apache, LGPL and artwork notices remain attached to
their components. The rest of the original MIT source retains its notice. No
claim of a blanket MIT license is made for the combined browser distribution.
See `public/js/vendor/procedural-NOTICES.txt` and `public/licenses/GPL-3.0.txt`.

The production build packages complete installed engine/dependency source,
host JavaScript, build scripts, upstream notices, provenance, and locked package
inputs in checksum-verified 512 KiB parts under `public/licenses/procedural-source/`.
`public/licenses/source.html` assembles one complete archive for download. The preview links to both
notices and source. Unpack the archive, run `npm ci`, then
`node scripts/planner-vendor.mjs` to rebuild the procedural bundles. Downloaded
archives contain source for the exact release, including the modified Mapgen4
adapter. `sources/engines.json` identifies upstream commits and modifications.

The original `procedural-source.tar.gz` remains a frozen source snapshot for the unchanged vendored engines and their embedded source URL. The source download page provides the complete current host and engine source. Parts have content-specific names and a SHA-256 manifest so mixed or incomplete downloads fail verification.
