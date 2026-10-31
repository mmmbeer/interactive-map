import { PdfFont } from './pdf-font.js';
const encoder=new TextEncoder();
const bytes=value=>typeof value==='string'?encoder.encode(value):value;
const n=value=>Number(value.toFixed(3));
export const pdfString=value=>'('+String(value).replaceAll('\\','\\\\').replaceAll('(','\\(').replaceAll(')','\\)').replace(/[\r\n]/g,' ')+')';
export class PdfDocument {
  constructor(font,bold) {this.objects=[null];this.pages=[];this.destinations=new Map();this.font=font;this.bold=bold;}
  object(content='') {this.objects.push(bytes(content));return this.objects.length-1;}
  stream(dictionary,content) {
    const data=bytes(content),head=bytes(`<< ${dictionary} /Length ${data.length} >>\nstream\n`),tail=bytes('\nendstream');
    const result=new Uint8Array(head.length+data.length+tail.length);result.set(head);result.set(data,head.length);result.set(tail,head.length+data.length);return this.object(result);
  }
  page(title='') {const page={id:this.object(),commands:[],links:[],title};this.pages.push(page);return page;}
  text(page,text,x,y,size=10,bold=false,color='0.1 0.1 0.2') {
    page.commands.push(`BT /${bold?'F2':'F1'} ${size} Tf ${color} rg 1 0 0 1 ${n(x)} ${n(792-y)} Tm ${(bold?this.bold:this.font).encode(text)} Tj ET`);
  }
  rect(page,x,y,w,h,color='0.96 0.96 0.92') {page.commands.push(`${color} rg ${n(x)} ${n(792-y-h)} ${n(w)} ${n(h)} re f`);}
  line(page,x1,y1,x2,y2) {page.commands.push(`0.75 0.75 0.75 RG 0.5 w ${n(x1)} ${n(792-y1)} m ${n(x2)} ${n(792-y2)} l S`);}
  link(page,x,y,w,h,dest,uri=false) {page.links.push({x,y,w,h,dest,uri});}
  destination(name,page,y=40) {this.destinations.set(name,{page,y});}
  wrap(text,width,size=10,bold=false) {
    const font=bold?this.bold:this.font,lines=[];
    for(const paragraph of String(text).split(/\r?\n/)) {
      let line='';
      for(const word of paragraph.split(/\s+/)) {
        const candidate=line?`${line} ${word}`:word;
        if(font.measure(candidate,size)<=width) {line=candidate;continue;}
        if(line){lines.push(line);line='';}
        // Split long URLs and unbroken author-supplied values without overflow.
        for(const char of word) {if(line && font.measure(line+char,size)>width){lines.push(line);line='';}line+=char;}
      }
      lines.push(line);
    }
    return lines;
  }
  async compressedStream(content) {
    if(typeof CompressionStream==='undefined')return this.stream('',content);
    const stream=new Blob([content]).stream().pipeThrough(new CompressionStream('deflate'));
    return this.stream('/Filter /FlateDecode',new Uint8Array(await new Response(stream).arrayBuffer()));
  }
  async finish(title,image,{signal,onProgress=()=>{}}={}) {
    this.pages.forEach((page,i)=>this.text(page,String(i+1),550,767,9));
    const font=this.font.embed(this,'AtlasSans'),bold=this.bold.embed(this,'AtlasSansBold');
    const imageId=image?this.stream(`/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`,image.bytes):null;
    const parent=this.object();
    for(const [i,page] of this.pages.entries()) {
      if(signal?.aborted)throw new DOMException('Export cancelled.','AbortError');
      const content=await this.compressedStream(page.commands.join('\n'));
      if(i%50===0)onProgress(`Compressing pages ${i+1} / ${this.pages.length}…`);
      const links=page.links.map(l=>this.object(`<< /Type /Annot /Subtype /Link /Rect [${n(l.x)} ${n(792-l.y-l.h)} ${n(l.x+l.w)} ${n(792-l.y)}] /Border [0 0 0] ${l.uri?`/A << /S /URI /URI ${pdfString(l.dest)} >>`:`/Dest ${pdfString(l.dest)}`} >>`));
      this.objects[page.id]=bytes(`<< /Type /Page /Parent ${parent} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R /F2 ${bold} 0 R >> ${imageId?`/XObject << /Map ${imageId} 0 R >>`:''} >> /Contents ${content} 0 R /Annots [${links.map(id=>`${id} 0 R`).join(' ')}] >>`);
    }
    this.objects[parent]=bytes(`<< /Type /Pages /Kids [${this.pages.map(p=>`${p.id} 0 R`).join(' ')}] /Count ${this.pages.length} >>`);
    const destinations=[...this.destinations].sort(([a],[b])=>a<b?-1:1).map(([name,d])=>`${pdfString(name)} [${d.page.id} 0 R /XYZ 0 ${n(792-d.y)} null]`).join(' ');
    const catalog=this.object(`<< /Type /Catalog /Pages ${parent} 0 R /Names << /Dests << /Names [${destinations}] >> >> >>`);
    const info=this.object();
    // Metadata strings use UTF-16BE independently of the embedded page fonts.
    this.objects[info]=bytes(`<< /Title <feff${title.split('').map(c=>c.charCodeAt(0).toString(16).padStart(4,'0')).join('')}> /Producer (The Wandering Atlas) >>`);
    const chunks=[bytes('%PDF-1.7\n% Atlas linked guide\n')],offsets=[0];let length=chunks[0].length;
    for(let i=1;i<this.objects.length;i++) {offsets[i]=length;const a=bytes(`${i} 0 obj\n`),b=bytes('\nendobj\n');chunks.push(a,this.objects[i],b);length+=a.length+this.objects[i].length+b.length;}
    const xref=length;chunks.push(bytes(`xref\n0 ${this.objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(o=>`${String(o).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${this.objects.length} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF`));
    return new Blob(chunks,{type:'application/pdf'});
  }
}
export async function loadPdfFonts() {
  const paths=['AtlasSans.ttf','AtlasSans-Bold.ttf'];
  return Promise.all(paths.map(async path=>{const response=await fetch(new URL(`assets/fonts/${path}`,document.baseURI));if(!response.ok)throw new Error('The PDF fonts could not be loaded. Reload and try again.');return new PdfFont(await response.arrayBuffer());}));
}
