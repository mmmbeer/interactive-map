import { traceShape } from '../geometry.js';
// Draw every outer casing before any road interior. Junctions share an open
// surface rather than exposing the border of whichever street was drawn last.
export function drawRoads(ctx,streets,unit,ink) {
  const ground=streets.filter(p=>!p.worldStyle?.bridge),bridges=streets.filter(p=>p.worldStyle?.bridge);
  ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
  for(const p of ground){traceShape(ctx,p);ctx.strokeStyle='#a4a18e';ctx.lineWidth=p.shape.width+unit;ctx.stroke();}
  for(const p of ground){traceShape(ctx,p);ctx.strokeStyle='#fbfaf4';ctx.lineWidth=p.shape.width;ctx.stroke();}
  for(const p of bridges) {
    traceShape(ctx,p);ctx.strokeStyle=ink;ctx.lineWidth=p.shape.width+unit*2;ctx.stroke();
    ctx.strokeStyle='#fbfaf4';ctx.lineWidth=p.shape.width;ctx.stroke();
  }
  ctx.restore();
}
