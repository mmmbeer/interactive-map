import {test} from 'node:test';
import assert from 'node:assert/strict';
import {overlaySize,prepareOverlay,MAX_OVERLAY_PIXELS} from '../public/js/map-canvas.js';
import {MapStage} from '../public/js/map-stage.js';
import {WorldView} from '../public/js/world-maps/world-view.js';
const fixture=()=>({id:'demo',name:'Demo',subtitle:'A city',theme:'City',region:'Coast',description:'Example',
  image:'assets/map.webp',thumbnail:'assets/thumb.webp',width:100,height:100,
  locations:[{id:'home',name:'Home',description:'Home',district:'Old Town',category:'home',x:50,y:50}]});

test('overlay stores have a fixed budget while drawing in original map coordinates',()=>{
  for(const [width,height] of [[948,1659],[3548,1774],[8192,2929],[1,8192]]) {
    const size=overlaySize(width,height);assert.ok(size.width*size.height<=MAX_OVERLAY_PIXELS);
    assert.ok(size.width<=4096&&size.height<=4096);
    let transform;const ctx={setTransform(...args){transform=args;}},canvas={getContext:()=>ctx};
    assert.equal(prepareOverlay(canvas,width,height),ctx);
    assert.equal(transform[0]*width,canvas.width);assert.equal(transform[3]*height,canvas.height);
  }
});
test('pointer bursts produce one draw and queued rendering stops when destroyed',()=>{
  const oldRequest=globalThis.requestAnimationFrame,oldCancel=globalThis.cancelAnimationFrame;
  let scheduled=0,cancelled,callback;globalThis.requestAnimationFrame=fn=>{scheduled++;callback=fn;return 42;};globalThis.cancelAnimationFrame=id=>{cancelled=id;};
  try {
    const draws=[],stage=Object.assign(Object.create(MapStage.prototype),{w:100,constrain(){},draw(animate){draws.push([this.tx,animate]);}});
    for(let i=0;i<20;i++){stage.tx=i;stage.render(i===3);}
    assert.equal(scheduled,1);callback();assert.deepEqual(draws,[[19,true]]);
    stage.render();const canvases=Array.from({length:4},()=>({width:100,height:100}));
    [stage.canvas,stage.baseCanvas]=canvases;stage.streetLayer={canvas:canvases[2]};stage.districtLayer={canvas:canvases[3]};
    stage.resizeObserver={disconnect(){}};stage.callbacks={hover(){}};stage.destroy();
    assert.equal(cancelled,42);assert.ok(canvases.every(c=>c.width===0&&c.height===0));
    stage.render();assert.equal(scheduled,2);
  } finally {globalThis.requestAnimationFrame=oldRequest;globalThis.cancelAnimationFrame=oldCancel;}
});
test('unchanged hover does not clear a map-sized canvas repeatedly',()=>{
  let clears=0;const stage=Object.assign(Object.create(MapStage.prototype),{scale:1,data:{width:8000,height:3000},pinEls:[],context:{clearRect(){clears++;}}});
  for(let i=0;i<100;i++)stage.highlight(null);assert.equal(clears,1);
  stage.scale=2;stage.highlight(null);assert.equal(clears,2);
});
test('region navigation coalesces tile and wizard updates into a display frame',()=>{
  const old=globalThis.requestAnimationFrame;let callback,calls=0,renders=0;
  globalThis.requestAnimationFrame=fn=>{calls++;callback=fn;return 1;};
  try {
    const world=Object.assign(Object.create(WorldView.prototype),{render(){renders++;}});
    for(let i=0;i<100;i++)world.draw();assert.equal(calls,1);callback();assert.equal(renders,1);
    world.destroyed=true;world.draw();assert.equal(calls,1);
  } finally {globalThis.requestAnimationFrame=old;}
});