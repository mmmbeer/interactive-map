import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rasterQuality } from '../public/js/raster-quality.js';
import { MapStage } from '../public/js/map-stage.js';
test('native-resolution calculations use actual image pixels and device density',()=>{
  assert.equal(rasterQuality(948,948,1,1).enlarged,false);
  assert.equal(rasterQuality(948,948,2.8,1).enlarged,true);
  assert.equal(rasterQuality(948,948,.5,2).nativeScale,.5);
  assert.equal(rasterQuality(948,948,.5,2).enlarged,false);
  assert.equal(rasterQuality(948,3792,2,2).enlarged,false);
  assert.equal(rasterQuality(948,3792,3,2).enlarged,true);
  assert.equal(rasterQuality(948,0,1,0).nativeScale,1);
  assert.equal(rasterQuality(948,948,1,.75).enlarged,false);
});
test('native view preserves its center and respects fitted and maximum zoom limits',()=>{
  const stage={w:800,h:600,tx:-200,ty:-300,scale:2,min:.4,max:4,data:{width:948},image:{naturalWidth:948},stopNavigation(){},center(x,y){this.centered=[x,y];}};
  const original=globalThis.devicePixelRatio;
  try {
    globalThis.devicePixelRatio=2;MapStage.prototype.native.call(stage);
    assert.equal(stage.scale,.5);assert.deepEqual(stage.centered,[300,300]);
    stage.image.naturalWidth=18960;MapStage.prototype.native.call(stage);assert.equal(stage.scale,4);
  } finally {if(original===undefined)delete globalThis.devicePixelRatio;else globalThis.devicePixelRatio=original;}
});
