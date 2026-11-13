import { randomFor } from './random.js';
// Placement and physical dimensions belong to the upstream planner. This ink
// treatment only cuts roof wings out of detached envelopes, never expands them.
export function outlineEngineRoof(state,building) {
  const ring=building.ring,random=randomFor(state.map,`engine-roof:${building.id}`);
  if(ring.length!==4||!building.glyphBacked)return {shape:{kind:'polygon',points:ring},form:building.glyph||building.kind};
  const point=(u,v)=>[ring[0][0]+(ring[1][0]-ring[0][0])*u+(ring[3][0]-ring[0][0])*v,ring[0][1]+(ring[1][1]-ring[0][1])*u+(ring[3][1]-ring[0][1])*v];
  const roll=random(),form=roll<.48?'cottage':roll<.67?'longhouse':roll<.83?'L-house':roll<.94?'T-house':'courtyard';
  let uv;
  if(form==='L-house')uv=[[0,0],[1,0],[1,.45],[.45,.45],[.45,1],[0,1]];
  else if(form==='T-house')uv=[[0,0],[1,0],[1,.45],[.68,.45],[.68,1],[.32,1],[.32,.45],[0,.45]];
  else if(form==='courtyard')uv=[[0,0],[1,0],[1,1],[.75,1],[.75,.4],[.25,.4],[.25,1],[0,1]];
  else uv=[[0,0],[1,0],[1,1],[0,1]];
  return {shape:{kind:'polygon',points:uv.map(([u,v])=>point(u,v))},form};
}
