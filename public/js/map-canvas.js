// Overlay coordinates stay in image space while their backing stores stay bounded.
// Four 24 MP overlays otherwise consume about 366 MiB before the map image itself.
export const MAX_OVERLAY_PIXELS=4*1024*1024;
export function overlaySize(width,height) {
  const scale=Math.min(1,Math.sqrt(MAX_OVERLAY_PIXELS/(width*height)),4096/Math.max(width,height));
  return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale))};
}
export function prepareOverlay(canvas,width,height) {
  const size=overlaySize(width,height);
  canvas.width=size.width;canvas.height=size.height;
  const ctx=canvas.getContext('2d');
  ctx.setTransform(size.width/width,0,0,size.height/height,0,0);
  return ctx;
}
