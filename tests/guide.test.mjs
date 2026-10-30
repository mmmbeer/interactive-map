import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { siteNumbers, entrySections } from '../public/js/site-index.js';
import { mapSheets } from '../public/js/guide-maps.js';
import { PdfFont } from '../public/js/pdf-font.js';
import { PdfDocument } from '../public/js/pdf-writer.js';
import { createGuidePdf } from '../public/js/guide-pdf.js';
const locations=[{id:'small-house',name:'Café Rook’s',x:30,y:40,category:'home',district:'Old Town',description:'A house.',person:'Élodie',rumor:'A secret.',services:'Repairs',demographics:{race:'elf',population:3},extra:{custom:{label:'History',text:'A complete custom history.'}}},{id:'ancient-keep',name:'Keep',x:300,y:400,category:'landmark',district:'Old Town',description:'A keep.'}];
async function fonts() {
  return Promise.all(['AtlasSans.ttf','AtlasSans-Bold.ttf'].map(async path=>{
    const data=await readFile(new URL('../public/assets/fonts/'+path,import.meta.url));
    return new PdfFont(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength));
  }));
}
test('site numbering ignores filters, order and lazy generated fields',()=>{
  const items=locations.map(p=>({...p,get description(){throw new Error('Do not materialize');}}));
  const a=siteNumbers(items),b=siteNumbers([...items].reverse());
  assert.deepEqual(a,b);assert.equal(a.get('small-house'),2);assert.equal(a.get('ancient-keep'),1);
});
test('full guide entries include custom content and demographics',()=>{
  const fields=new Map(entrySections(locations[0]));
  assert.equal(fields.get('Word on the street'),'A secret.');assert.equal(fields.get('History'),'A complete custom history.');
  assert.match(fields.get('Demographics'),/population: 3/);
});
test('detail sheets partition every site exactly once including coincident and boundary points',()=>{
  const points=Array.from({length:140},(_,i)=>({id:String(i),x:i<4?100:i%10*30,y:i<4?100:Math.floor(i/10)*40}));
  points.push({id:'edge',x:600,y:800});
  const sheets=mapSheets({width:600,height:800},points),ids=sheets.flatMap(s=>s.places.map(p=>p.id));
  assert.equal(ids.length,points.length);assert.equal(new Set(ids).size,points.length);assert.ok(sheets.length>2);
  for(const sheet of sheets)for(const p of sheet.places){assert.ok(p.x>=sheet.x&&p.x<=sheet.x+sheet.w);assert.ok(p.y>=sheet.y&&p.y<=sheet.y+sheet.h);}
});
test('Unicode fonts measure and encode curly punctuation and accented names',async()=>{
  const [font]=await fonts();assert.ok(font.glyph('É'.codePointAt(0))>0);assert.ok(font.glyph('’'.codePointAt(0))>0);
  assert.ok(font.measure('WWW',10)>font.measure('iii',10));assert.match(font.encode('Élodie’s'),/^<[a-f0-9]+>$/);
  const pdf=new PdfDocument(font,font);
  for(const line of pdf.wrap('LongUnbrokenValue'.repeat(70),100,10))assert.ok(font.measure(line,10)<=100);
});
test('PDF has complete internal link targets, external site links and valid byte offsets',async()=>{
  const blob=await createGuidePdf({id:'demo',name:'Demo',width:600,height:800,locations},locations,{fonts:await fonts(),baseURL:'https://example.com/atlas'});
  const buffer=Buffer.from(await blob.arrayBuffer()),text=buffer.toString('latin1');
  assert.match(text,/%PDF-1.7/);assert.match(text,/\/ToUnicode/);assert.match(text,/\/URI \(https:\/\/example.com\/atlas#map\/demo\/small-house\)/);
  const names=text.match(/\/Dests << \/Names \[([\s\S]*?)\] >> >> >>/)[1];
  for(const match of text.matchAll(/\/Dest \(([^)]+)\)/g))assert.ok(names.includes(`(${match[1]})`),match[1]);
  assert.match(names,/site-small-house/);assert.match(names,/index-small-house/);
  const xref=Number(text.match(/startxref\n(\d+)/)[1]);assert.equal(buffer.subarray(xref,xref+4).toString(),'xref');
  const rows=text.slice(xref).split('\n');
  for(let i=3;i<rows.length&&/^\d{10} 00000 n/.test(rows[i]);i++)assert.ok(buffer.subarray(Number(rows[i].slice(0,10))).toString('latin1').startsWith(`${i-2} 0 obj`));
});
test('PDF export can be cancelled and rejects empty selections',async()=>{
  const controller=new AbortController();controller.abort();
  await assert.rejects(createGuidePdf({locations},locations,{signal:controller.signal}),{name:'AbortError'});
  await assert.rejects(createGuidePdf({locations},[]),/at least one/);
});
test('long site content spans pages without losing its final text or link destinations',async()=>{
  const place={...locations[0],description:('A complete paragraph with accented names like Élodie. '.repeat(500))+'\nEND OF LONG ENTRY'};
  const status=[],embeddedFonts=await fonts();
  const blob=await createGuidePdf({id:'demo',name:'Demo',width:600,height:800,locations:[place]},[place],{fonts:embeddedFonts,onProgress:s=>status.push(s)});
  const text=Buffer.from(await blob.arrayBuffer()).toString('latin1');
  const pages=Number(text.match(/\/Type \/Pages[\s\S]*?\/Count (\d+)/)[1]);
  const streams=[...text.matchAll(/<<[^>]*\/Filter \/FlateDecode[^>]*\/Length (\d+) >>\nstream\n/g)].map(m=>inflateSync(Buffer.from(text,'latin1').subarray(m.index+m[0].length,m.index+m[0].length+Number(m[1]))).toString());
  assert.ok(streams.some(s=>s.includes(embeddedFonts[0].encode('END OF LONG ENTRY'))));
  assert.ok(pages>4);assert.match(text,/site-small-house/);assert.ok(status.some(s=>s.startsWith('Compressing')));
});
