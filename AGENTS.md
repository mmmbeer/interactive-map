# Working on Interactive Map

- This is a static HTML, CSS and ES module website for Cloudflare Pages.
- Keep every script at or below 500 lines. The build also checks HTML and CSS limits. Split responsibilities into small files.
- Keep runtime dependency-free. Use the versioned, deterministic browser generator for location content. Do not add a framework or backend.
- Source lives in `public/`. `dist/` is committed. Run `npm test` and `npm run build` after changes and commit the matching build.
- Follow `docs/adding-maps.md` when given another map in a work chat.
- Use the supplied image as the map. Save stable location ids, geometry, category/type, district and generation inputs. Generate text from those inputs when read. Never randomize coordinates on page load.
- Locate points on visible structures or recognizable features. Do not put ordinary buildings in water. Treat raster extraction as an approximation and inspect placements visually.
- Preserve authored landmark text in `overrides`. Populate smaller buildings with compact generation inputs and inherited demographics. See `docs/generation.md` before changing generation.
- Keep existing map ids and location ids stable because links are shareable. Do not regenerate existing content without an explicit request.
- Add a separate image directory and JSON file per map. Register it with `node scripts/register-map.mjs <id>`.
- Use image-space pixel coordinates. Keep image width and height accurate and coordinates within bounds.
- All visitor-facing text from data must pass through `escape()` before entering HTML.
- Never serialize materialized locations back to source. Export the compact authoring model. Preserve explicit overrides and inherited settings.
- Never change the v1 RNG, default pools or patterns after release. Add a generator version and retain old version support when changing defaults. Use per-map catalog overrides for content tuning.
- Preserve mouse, touch and keyboard support. Inspect desktop and mobile layouts for interface changes.
- Deploy on Cloudflare Pages. Do not create a separate hosted Site or change hosting providers unless asked.
