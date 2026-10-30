import { categories } from './ui.js';
import { entrySections, siteNumbers } from './site-index.js';
import { PdfDocument, loadPdfFonts } from './pdf-writer.js';
import { drawMap, mapBadge, mapSheets } from './guide-maps.js';
const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
function check(signal) {if(signal?.aborted)throw new DOMException('Export cancelled.','AbortError');}
export async function mapImage(image,signal) {
  check(signal);await image.decode();check(signal);
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  canvas.getContext('2d').drawImage(image,0,0);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.94));
  if(!blob)throw new Error('The map image could not be prepared for PDF.');
  return {width:canvas.width,height:canvas.height,bytes:new Uint8Array(await blob.arrayBuffer())};
}
export async function createGuidePdf(data,places,{fonts,image,baseURL='',signal,onProgress=()=>{}}={}) {
  if(!places.length)throw new Error('Choose at least one site to export.');
  check(signal);fonts ||= await loadPdfFonts();
  const pdf=new PdfDocument(...fonts),numbers=siteNumbers(data.locations);
  const entries=[...places].sort((a,b)=>numbers.get(a.id)-numbers.get(b.id));
  const entryDest=p=>`site-${p.id}`,mapDest=new Map(),indexDest=new Map();
  function page(title,section='SITE GUIDE') {
    const p=pdf.page(title);pdf.text(p,'THE WANDERING ATLAS / '+section,48,30,8,true,'0.35 0.35 0.4');
    pdf.text(p,title,48,58,18,true);pdf.line(p,48,746,564,746);
    pdf.text(p,'Map overview',48,767,8);pdf.link(p,48,755,85,18,'map-overview');
    pdf.text(p,'Site index',151,767,8);pdf.link(p,151,755,70,18,'site-index');return p;
  }
  onProgress('Preparing linked map sheets…');await pause();check(signal);
  const overview=page(data.name,'MAP OVERVIEW');pdf.destination('map-overview',overview);
  pdf.text(overview,`${entries.length.toLocaleString()} entries. Select a number or sheet to read its sites.`,48,79,9);
  const project=drawMap(pdf,overview,data,{x:0,y:0,w:data.width,h:data.height},{x:48,y:96,w:516,h:620});
  const sheets=mapSheets(data,entries);
  if(sheets.length===1) {
    const occupied=[];for(const p of entries){mapBadge(pdf,overview,numbers.get(p.id),project(p),entryDest(p),occupied);mapDest.set(p.id,'map-overview');}
  } else {
    for(const [i,sheet] of sheets.entries()) {
      const sheetName=`map-sheet-${i+1}`,p=page(`${data.name} / Sheet ${i+1}`,'DETAIL MAP');pdf.destination(sheetName,p);
      pdf.text(p,'Numbered markers link to full entries. Return links lead back to this sheet.',48,79,8.5);
      const position=drawMap(pdf,p,data,sheet,{x:48,y:96,w:516,h:620}),occupied=[];
      for(const place of sheet.places){mapBadge(pdf,p,numbers.get(place.id),position(place),entryDest(place),occupied);mapDest.set(place.id,sheetName);}
      const a=project(sheet),b=project({x:sheet.x+sheet.w,y:sheet.y+sheet.h});
      overview.commands.push(`0.12 0.1 0.4 RG 0.4 w ${a.x} ${792-b.y} ${b.x-a.x} ${b.y-a.y} re S`);
      const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
      if(sheets.length<=45){pdf.rect(overview,mx-8,my-5,16,10,'0.96 1 0.56');pdf.text(overview,String(i+1),mx-6,my+2.5,5.5,true);}
      pdf.link(overview,a.x,a.y,b.x-a.x,b.y-a.y,sheetName);
      if(i%20===0){await pause();check(signal);}
    }
  }
  // Two-column index. Every row has its own return destination.
  let index=page(`${data.name} / Site index`),column=0,y=98;
  pdf.destination('site-index',index);
  for(const [i,p] of entries.entries()) {
    const lines=pdf.wrap(`${numbers.get(p.id)}  ${p.name}`,240,9,true);
    const height=lines.length*12+15;
    if(y+height>724){if(column===0){column=1;y=98;}else{index=page(`${data.name} / Site index`);column=0;y=98;}}
    const x=48+column*264,dest=`index-${p.id}`;indexDest.set(p.id,dest);pdf.destination(dest,index,y-12);
    for(const [j,line] of lines.entries())pdf.text(index,line,x,y+j*12,9,true);
    pdf.text(index,pdf.wrap(`${p.district} · ${categories[p.category].singular}`,240,8)[0],x,y+lines.length*12,8,false,'0.4 0.4 0.45');
    pdf.link(index,x,y-10,244,height,entryDest(p));y+=height+6;
    if(i%80===0){onProgress(`Indexing sites ${i+1} / ${entries.length}…`);await pause();check(signal);}
  }
  // Flow complete entries across pages. Never truncate a long field.
  let detail,yDetail=800;
  const nextDetail=()=>{detail=page(`${data.name} / Entries`);yDetail=92;};
  const ensure=height=>{if(yDetail+height>724)nextDetail();};
  const paragraph=(text,size=10,bold=false)=>{
    for(const line of pdf.wrap(text,516,size,bold)){ensure(size*1.5);pdf.text(detail,line,48,yDetail,size,bold);yDetail+=size*1.5;}
  };
  for(const [i,p] of entries.entries()) {
    const title=`${numbers.get(p.id)}. ${p.name}`,titleLines=pdf.wrap(title,516,15,true);
    ensure(Math.min(200,titleLines.length*22+90));pdf.destination(entryDest(p),detail,yDetail-20);
    paragraph(title,15,true);paragraph(`${p.district} · ${categories[p.category].singular}`,9);
    if(p.address)paragraph(p.address,9);
    yDetail+=5;
    for(const [label,text] of entrySections(p)) {ensure(42);paragraph(label.toUpperCase(),8,true);paragraph(String(text));yDetail+=8;}
    ensure(26);
    pdf.text(detail,'Back to map',48,yDetail,8,true);pdf.link(detail,48,yDetail-10,85,17,mapDest.get(p.id));
    pdf.text(detail,'Back to index',158,yDetail,8,true);pdf.link(detail,158,yDetail-10,85,17,indexDest.get(p.id));
    if(baseURL) {
      const url=new URL(baseURL);url.hash=`map/${data.id}/${p.id}`;
      pdf.text(detail,'Open interactive site',278,yDetail,8,true);pdf.link(detail,278,yDetail-10,125,17,url.href,true);
    }
    yDetail+=16;pdf.line(detail,48,yDetail,564,yDetail);yDetail+=26;
    if(i%20===0){onProgress(`Writing full entries ${i+1} / ${entries.length}…`);await pause();check(signal);}
  }
  onProgress('Finishing PDF…');await pause();check(signal);
  return pdf.finish(`${data.name} - Site guide`,image,{signal,onProgress});
}
