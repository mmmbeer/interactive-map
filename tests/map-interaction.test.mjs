import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MapStage } from '../public/js/map-stage.js';
import { calloutPosition, connectorEnd } from '../public/js/callout-layout.js';
function harness() {
  const selected=[],place={id:'one',x:100,y:100};
  const stage=Object.assign(Object.create(MapStage.prototype),{
    el:{setPointerCapture(id){this.captured=id;},classList:{remove(){},toggle(){}}},
    pointers:new Map(),placeIndex:new Map([['one',place]]),tx:0,ty:0,scale:1,
    local:e=>({x:e.clientX,y:e.clientY}),stopNavigation(){},render(){},highlight(){},highlightDistrict(){},
    callbacks:{hover(){},select:p=>selected.push(p)},at:()=>place
  });
  const event=(x,y,id=1,type='mouse')=>({button:0,pointerId:id,pointerType:type,clientX:x,clientY:y,preventDefault(){this.prevented=true;},target:{closest:s=>s==='.map-pin,.site-number'?{dataset:{id:'one'}}:null}});
  return {stage,event,selected,place};
}
test('a gesture starting on a marker pans and does not select on release',()=>{
  const {stage,event,selected}=harness(),down=event(100,100);
  stage.down(down);assert.equal(stage.el.captured,1);assert.ok(down.prevented);
  stage.move(event(145,130));stage.up(event(145,130));
  assert.equal(stage.tx,45);assert.equal(stage.ty,30);assert.deepEqual(selected,[]);
  assert.equal(stage.pointers.size,0);
});
test('a marker tap selects once and a following gesture can still pan',()=>{
  const {stage,event,selected,place}=harness();
  stage.down(event(100,100));stage.up(event(100,100));assert.deepEqual(selected,[place]);
  stage.cancel(event(100,100));assert.equal(stage.dragged,false);
  stage.down(event(110,110));stage.move(event(90,80));stage.up(event(90,80));
  assert.deepEqual(selected,[place]);assert.equal(stage.tx,-20);
});
test('pinching or cancelling cannot become an accidental location selection',()=>{
  const {stage,event,selected}=harness();
  stage.down(event(100,100,1,'touch'));stage.down(event(160,160,2,'touch'));
  stage.up(event(160,160,2,'touch'));stage.up(event(100,100,1,'touch'));
  assert.deepEqual(selected,[]);
  stage.down(event(100,100));stage.cancel(event(100,100));stage.up(event(100,100));
  assert.deepEqual(selected,[]);assert.equal(stage.pointers.size,0);
});
test('authoring point callbacks take precedence over marker selection',()=>{
  const {stage,event,selected}=harness();stage.callbacks.point=()=>true;
  stage.down(event(100,100));stage.up(event(100,100));assert.deepEqual(selected,[]);
});
test('callouts stay within narrow and desktop viewports at edges and after dragging',()=>{
  for(const viewport of [{w:340,h:650},{w:1100,h:700}]) {
    const size={w:Math.min(320,viewport.w-24),h:300};
    for(const anchor of [{x:0,y:0},{x:viewport.w,y:viewport.h},{x:150,y:300}]) {
      for(const offset of [null,{x:-1000,y:2000}]) {
        const p=calloutPosition(anchor,size,viewport,offset);
        assert.ok(p.x>=12 && p.x+size.w<=viewport.w-12);
        assert.ok(p.y>=12 && p.y+size.h<=viewport.h-12);
      }
    }
  }
});
test('connector meets the card border and hides when its anchor is covered',()=>{
  const box={x:100,y:100,w:300,h:200};
  assert.deepEqual(connectorEnd({x:0,y:200},box),{x:100,y:200});
  assert.deepEqual(connectorEnd({x:250,y:0},box),{x:250,y:100});
  assert.equal(connectorEnd({x:250,y:200},box),null);
});
