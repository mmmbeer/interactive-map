# Map image fidelity

Dragonsgate uses a 948 x 1659 pixel raster. The Reddit preview supplied on 2026-10-30 explicitly requests width 948. The directly retrievable image at https://i.redd.it/00xpkux5ffyh1.png also has those dimensions. A larger source could not be retrieved during this update.

The active asset is `public/assets/maps/dragonsgate/map-native.webp`. It is a lossless encoding of that downloaded image, verified pixel for pixel after decoding. The earlier `map.webp` remains available for old links and cached map data. The new filename ensures current map data requests the lossless asset. The existing logical coordinates, boundaries, roads and deterministic generation inputs are unchanged.

To prepare the same asset from a downloaded original:

```sh
python scripts/prepare-map-image.py original.png public/assets/maps/dragonsgate/map-native.webp --expected-size 948 1659
```

The viewer compares natural image pixels with the current scale and device pixel ratio. It uses normal interpolation when reducing the image and pixel-preserving rendering when enlarging it. It reserves compositor prepromotion for animated navigation instead of keeping the whole map permanently promoted. Text labels keep their normal rendering.

The eye control opens the native-resolution view, within the fitted and maximum zoom limits. Hover the zoom percentage to see enlargement relative to source pixels. About this map includes the dimensions and a direct image link.

These changes preserve edges and remove additional lossy encoding. They do not add genuine building detail beyond the supplied pixels. A larger original raster or vector source is required for more detail. Do not present an interpolated enlargement as a higher-resolution original. When replacing a map with different dimensions, update its geometry and coordinate-space metadata together, then inspect alignment.
