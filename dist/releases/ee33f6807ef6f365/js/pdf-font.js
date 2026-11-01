// Minimal TrueType reader for embedded Unicode PDF fonts. No network font service.
export class PdfFont {
  constructor(buffer) {
    this.bytes=new Uint8Array(buffer);const v=this.v=new DataView(buffer);this.tables={};
    for(let i=0;i<v.getUint16(4);i++) {
      const at=12+i*16,tag=String.fromCharCode(...this.bytes.slice(at,at+4));
      this.tables[tag]=v.getUint32(at+8);
    }
    const t=this.tables;this.units=v.getUint16(t.head+18);this.ascent=v.getInt16(t.hhea+4);this.descent=v.getInt16(t.hhea+6);
    this.bbox=[36,38,40,42].map(n=>this.metric(v.getInt16(t.head+n)));
    this.metrics=v.getUint16(t.hhea+34);this.used=new Map();this.glyphs=[0];this.unicode=[0];
    const count=v.getUint16(t.cmap+2),maps=[];
    for(let i=0;i<count;i++) {const at=t.cmap+4+i*8,offset=t.cmap+v.getUint32(at+4),format=v.getUint16(offset);if([4,12].includes(format))maps.push({offset,format});}
    this.cmap=maps.find(m=>m.format===12) || maps[0];
    if(!this.cmap)throw new Error('Unsupported font character map.');
  }
  metric(n) {return Math.round(n/this.units*1000);}
  glyph(code) {
    const v=this.v,{offset:o,format}=this.cmap;
    if(format===12) {
      let lo=0,hi=v.getUint32(o+12)-1;
      while(lo<=hi) {const mid=(lo+hi)>>1,at=o+16+mid*12,a=v.getUint32(at),b=v.getUint32(at+4);if(code<a)hi=mid-1;else if(code>b)lo=mid+1;else return v.getUint32(at+8)+code-a;}
    } else if(code<=65535) {
      const n=v.getUint16(o+6)/2;
      for(let i=0;i<n;i++) {
        const end=v.getUint16(o+14+i*2),start=v.getUint16(o+16+n*2+i*2);
        if(code<start || code>end)continue;
        const delta=v.getInt16(o+16+n*4+i*2),rangeAt=o+16+n*6+i*2,range=v.getUint16(rangeAt);
        if(!range)return (code+delta)&65535;
        const g=v.getUint16(rangeAt+range+(code-start)*2);return g?(g+delta)&65535:0;
      }
    }
    return 0;
  }
  width(code) {return this.metric(this.v.getUint16(this.tables.hmtx+Math.min(this.metrics-1,this.glyph(code))*4));}
  measure(text,size) {return [...String(text)].reduce((sum,c)=>sum+this.width(c.codePointAt(0))*size/1000,0);}
  encode(text) {
    let hex='';
    for(const c of String(text)) {
      const code=c.codePointAt(0);let cid=this.used.get(code);
      if(!cid){cid=this.glyphs.length;this.used.set(code,cid);this.glyphs.push(this.glyph(code));this.unicode.push(code);}
      hex+=cid.toString(16).padStart(4,'0');
    }
    return `<${hex}>`;
  }
  embed(pdf,name) {
    const file=pdf.stream(`/Length1 ${this.bytes.length}`,this.bytes);
    const descriptor=pdf.object(`<< /Type /FontDescriptor /FontName /${name} /Flags 32 /FontBBox [${this.bbox.join(' ')}] /ItalicAngle 0 /Ascent ${this.metric(this.ascent)} /Descent ${this.metric(this.descent)} /CapHeight ${this.metric(this.ascent)} /StemV 80 /FontFile2 ${file} 0 R >>`);
    const map=new Uint8Array(this.glyphs.length*2);this.glyphs.forEach((g,i)=>{map[i*2]=g>>8;map[i*2+1]=g&255;});
    const cidMap=pdf.stream('',map);
    const widths=this.unicode.map(code=>this.width(code));
    const descendant=pdf.object(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${name} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptor} 0 R /W [0 [${widths.join(' ')}]] /CIDToGIDMap ${cidMap} 0 R >>`);
    const utf16=code=>code>65535?String.fromCodePoint(code).split('').map(c=>c.charCodeAt(0).toString(16).padStart(4,'0')).join(''):code.toString(16).padStart(4,'0');
    const lines=[];
    for(let i=0;i<this.unicode.length;i+=100) {const group=this.unicode.slice(i,i+100);lines.push(`${group.length} beginbfchar`,...group.map((code,j)=>`<${(i+j).toString(16).padStart(4,'0')}> <${utf16(code)}>`),'endbfchar');}
    const cmap=pdf.stream('',`/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /AtlasUnicode def /CMapType 2 def 1 begincodespacerange <0000> <ffff> endcodespacerange ${lines.join('\n')} endcmap CMapName currentdict /CMap defineresource pop end end`);
    return pdf.object(`<< /Type /Font /Subtype /Type0 /BaseFont /${name} /Encoding /Identity-H /DescendantFonts [${descendant} 0 R] /ToUnicode ${cmap} 0 R >>`);
  }
}
