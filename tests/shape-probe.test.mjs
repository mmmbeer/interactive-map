import test from 'node:test';
import assert from 'node:assert/strict';
import { contains, distanceToPath } from '../public/js/geometry.js';
import { shapeProbe, crosses } from '../public/js/world-maps/shape-probe.js';
const outer=[[0,0],[180,0],[180,130],[125,130],[125,70],[100,70],[100,180],[0,180]],hole=[[15,15],[65,15],[65,55],[15,55]];
const polygon={shape:{kind:'polygon',points:outer,holes:[hole]}};
const corners=([x,y,w,h])=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const ringCrosses=(ring,box)=>ring.some((p,i)=>crosses(p,ring[(i+1)%ring.length],box));
test('indexed polygon probes preserve concave boundaries, holes and exact edge contacts',()=>{
  const probe=shapeProbe(polygon);
  for(let y=-5;y<=185;y+=2.5)for(let x=-5;x<=185;x+=2.5)assert.equal(probe.inside(x,y),contains(polygon,x,y),`${x},${y}`);
  for(let y=0;y<180;y+=9)for(let x=0;x<180;x+=9) {
    const box=[x,y,12,16],vertices=corners(box),crossed=[outer,hole].some(r=>ringCrosses(r,box));
    assert.equal(probe.fits(box),vertices.every(([x,y])=>contains(polygon,x,y))&&!crossed);
    assert.equal(probe.intersects(box),vertices.some(([x,y])=>contains(polygon,x,y))||crossed);
  }
});
test('indexed line probes preserve line widths and bends',()=>{
  const p={shape:{kind:'polyline',width:14,points:[[0,0],[160,0],[160,100],[30,150]]}},probe=shapeProbe(p);
  for(let y=0;y<180;y+=8)for(let x=0;x<180;x+=8) {
    const box=[x,y,5,5],expanded=[x-7,y-7,19,19];
    assert.equal(probe.intersects(box),p.shape.points.some((b,i)=>i&&crosses(p.shape.points[i-1],b,expanded)));
    assert.equal(probe.fits(box),corners(box).every(([x,y])=>contains(p,x,y))&&p.shape.points.some((b,i)=>i&&corners(box).every(([x,y])=>distanceToPath([p.shape.points[i-1],b],x,y)<=7)));
  }
});
