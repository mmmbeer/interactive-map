import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { convertArea } from '../public/js/world-maps/model.js';
import { planDecorations } from '../public/js/world-maps/decoration-plan.js';
import { symbolFrames } from '../public/js/world-maps/cartography-symbols.js';
import { organicSource, organicOptions } from '../tests/fixtures/organic-coast.mjs';
import { peninsulaSource, peninsulaOptions } from '../tests/fixtures/peninsula-village.mjs';
const peninsula=process.argv[4]==='peninsula',source=peninsula?peninsulaSource:organicSource,options=peninsula?peninsulaOptions:organicOptions;
const seed=process.argv[2]||options.seed,type=process.argv[3]||options.settlement.type;
const started=performance.now(),{map}=convertArea(source,{...options,seed,settlement:{...options.settlement,type}});
const marks=await planDecorations(map),unit=map.width/4096;
const trace=s=>s.kind==='polyline'?`M${s.points.map(p=>p.join(',')).join('L')}`:[s.points,...(s.holes||[])].map(r=>`M${r.map(p=>p.join(',')).join('L')}Z`).join('');
const draw=(p,style)=>`<path d="${trace(p.shape)}" ${style}/>`;
const atlas=(await readFile(resolve('public/assets/cartography/kenney-ink-v1.png'))).toString('base64');
const parts=[`<svg xmlns="http://www.w3.org/2000/svg" width="${map.width}" height="${map.height}" viewBox="0 0 ${map.width} ${map.height}"><title>Seeded medieval settlement</title><defs><image id="atlas" width="1280" height="1280" href="data:image/png;base64,${atlas}"/>`];
for(const [name,frame] of Object.entries(symbolFrames))parts.push(`<symbol id="${name}" viewBox="${frame.join(' ')}"><use href="#atlas"/></symbol>`);
parts.push('</defs><rect width="100%" height="100%" fill="#eeeae1"/><g stroke-linejoin="round" stroke-linecap="round" fill-rule="evenodd">');
for(const p of map.locations.filter(p=>p.category==='terrain'))parts.push(draw(p,`fill="${p.type==='forest'?'#d8dccb':p.worldStyle?.landuse==='farmland'?'#dedfc3':'#d5dfc2'}" stroke="#9c9c89" stroke-width="${unit*.5}"`));
for(const p of map.locations.filter(p=>p.category==='water'))parts.push(draw(p,p.shape.kind==='polyline'?`fill="none" stroke="#91a6ad" stroke-width="${p.shape.width}"`:'fill="#91a6ad"'));
const roads=map.locations.filter(p=>p.category==='street');
for(const p of roads)parts.push(draw(p,`fill="none" stroke="#a4a18e" stroke-width="${p.shape.width+unit}"`));
for(const p of roads)parts.push(draw(p,`fill="none" stroke="#fbfaf4" stroke-width="${p.shape.width}"`));
for(const p of map.locations.filter(p=>p.worldStyle?.kind==='building'))parts.push(draw(p,`fill="#202421" stroke="#111813" stroke-width="${unit*.65}"`));
for(const mark of marks) {
  const frame=symbolFrames[mark.kind];
  if(frame){const w=frame[2]*mark.size/Math.max(frame[2],frame[3]),h=frame[3]*mark.size/Math.max(frame[2],frame[3]);parts.push(`<g opacity=".8" transform="translate(${mark.x} ${mark.y}) rotate(${mark.angle*180/Math.PI}) scale(${mark.flip} 1)"><use href="#${mark.kind}" x="${-w/2}" y="${-h/2}" width="${w}" height="${h}"/></g>`);}
  else parts.push(`<path d="M${mark.x-mark.size*.2},${mark.y+mark.size*.2}q0,${-mark.size*.25} ${-mark.size*.12},${-mark.size*.4}M${mark.x},${mark.y+mark.size*.2}q${mark.size*.1},${-mark.size*.3} 0,${-mark.size*.5}" fill="none" stroke="#202421" opacity=".4" stroke-width="${mark.size*.045}"/>`);
}
parts.push('</g></svg>');
await writeFile(peninsula?'docs/peninsula-village-preview.svg':'docs/organic-planner-preview.svg',parts.join(''));
if(process.env.LAYOUT_MODEL_OUTPUT)await writeFile(process.env.LAYOUT_MODEL_OUTPUT,JSON.stringify(map));
console.log(JSON.stringify({seed,type,elapsedMs:Math.round(performance.now()-started),...map.worldImport.procedural.planner.metrics,warnings:map.worldImport.planning.warnings},null,2));
