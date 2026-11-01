// Map geometry stays in logical image coordinates. Natural pixels determine fidelity.
export function rasterQuality(logicalWidth,naturalWidth,scale,devicePixelRatio=1) {
  const pixels=Number.isFinite(naturalWidth)&&naturalWidth>0?naturalWidth:logicalWidth;
  const ratio=Number.isFinite(devicePixelRatio)&&devicePixelRatio>0?devicePixelRatio:1;
  const nativeScale=pixels/logicalWidth/ratio;
  const enlargement=scale/nativeScale;
  return {nativeScale,enlargement,enlarged:enlargement>1.01};
}
