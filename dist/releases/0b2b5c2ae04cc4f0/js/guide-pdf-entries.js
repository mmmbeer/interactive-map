import { categories } from './ui.js';
import { entrySections } from './site-index.js';
import { guideCrop } from './guide-entry.js';
import { drawMap } from './guide-maps.js';
// The first line reserves room for a bold inline field label.
export function fieldLines(pdf,label,text,width,size=9) {
  const labelSize=7.2,prefix=label?label+'  ':'',indent=pdf.bold.measure(prefix,labelSize);
  if(indent>width*.6) return [...pdf.wrap(prefix,width,labelSize,true).map(text=>({text,size:labelSize,bold:true})),...fieldLines(pdf,'',text,width,size)];
  const lines=[];let line='';
  const limit=()=>width-(lines.length===0?indent:0);
  for(const paragraph of String(text).split(/\r?\n/)) {
    for(const word of paragraph.split(/\s+/)) {
      const candidate=line?line+' '+word:word;
      if(pdf.font.measure(candidate,size)<=limit()){line=candidate;continue;}
      if(line){lines.push(line);line='';}
      for(const char of word){if(line && pdf.font.measure(line+char,size)>limit()){lines.push(line);line='';}line+=char;}
    }
    lines.push(line);line='';
  }
  return lines.map((text,i)=>({text,size,offset:i===0?indent:0,label:i===0?prefix:'',labelSize}));
}
export async function writeGuideEntries(pdf,entries,{data,numbers,page,entryDest,mapDest,indexDest,baseURL,image,signal,onProgress}) {
  const width=246,top=94,bottom=724;let sheet,column=0,y=bottom+1;
  const x=()=>48+column*270;
  function advance(place,continued=false) {
    if(sheet && column===0)column=1;
    else {sheet=page(`${data.name} / Site guide`);column=0;pdf.line(sheet,306,86,306,728);}
    y=top;
    if(continued){
      const context=`${numbers.get(place.id)}. ${place.name.slice(0,80)} / continued`;
      for(const line of pdf.wrap(context,width,8,true)){pdf.text(sheet,line,x(),y,8,true);y+=11;}
      y+=5;
    }
  }
  const ensure=(height,place)=>{if(y+height>bottom)advance(place,true);};
  for(const [i,place] of entries.entries()) {
    if(signal?.aborted)throw new DOMException('Export cancelled.','AbortError');
    const num=numbers.get(place.id),badge=Math.max(23,pdf.bold.measure(String(num),8)+9),thumb=image?42:0;
    const titleLines=pdf.wrap(place.name,width-badge-7-(thumb?thumb+8:0),11,true);
    const metadata=pdf.wrap(`${categories[place.category].singular} · ${place.district}`,width,7.6);
    const address=place.address?pdf.wrap(place.address,width,7.6):[];
    const header=Math.max(thumb,titleLines.length*14)+6+(metadata.length+address.length)*10;
    const groups=entrySections(place).map(([label,text])=>{
      const description=label==='Description',profile=label==='Demographics',rumor=label==='Word on the street';
      const title=description?'':profile?'PROFILE':label==='A familiar face'?'PEOPLE':label==='Available here'?'SERVICES':rumor?'RUMOR':label.toUpperCase();
      return {lines:fieldLines(pdf,title,String(text),width-(rumor?7:0),profile?7.6:9),height:profile?10.5:12.5,rumor,profile};
    });
    const total=header+groups.reduce((n,g)=>n+g.lines.length*g.height+7,0)+32;
    if(!sheet || (total<=bottom-top && y+total>bottom) || (total>bottom-top && bottom-y<130))advance(place);
    pdf.destination(entryDest(place),sheet,y-14);
    pdf.rect(sheet,x(),y-2,badge,20,'0.03 0.01 0.34');pdf.text(sheet,String(num),x()+4,y+11,8,true,'0.96 1 0.56');
    if(image) {
      const position=drawMap(pdf,sheet,data,guideCrop(place),{x:x()+width-thumb,y:y-2,w:thumb,h:thumb});
      const center=position(place);pdf.rect(sheet,center.x-2,center.y-2,4,4,'1 0.62 0.11');
    }
    const start=y;
    for(const line of titleLines){ensure(15,place);pdf.text(sheet,line,x()+badge+7,y+10,11,true);y+=14;}
    y=Math.max(y,start+thumb)+6;
    for(const line of [...metadata,...address]){ensure(11,place);pdf.text(sheet,line,x(),y,7.6,false,'0.4 0.4 0.45');y+=10;}
    y+=3;
    for(const group of groups) {
      for(const line of group.lines){
        ensure(group.height,place);
        const left=x()+(group.rumor?7:0),color=group.profile?'0.4 0.4 0.45':group.rumor?'0.35 0.24 0.09':'0.1 0.1 0.2';
        if(group.rumor)pdf.rect(sheet,x(),y-8,1.5,group.height,'1 0.62 0.11');
        if(line.label)pdf.text(sheet,line.label,left,y,line.labelSize,true,'0.24 0.23 0.37');
        pdf.text(sheet,line.text,left+(line.offset||0),y,line.size,line.bold||false,color);y+=group.height;
      }
      y+=7;
    }
    ensure(22,place);
    pdf.text(sheet,'Map',x(),y,7.2,true);pdf.link(sheet,x(),y-9,30,14,mapDest.get(place.id));
    pdf.text(sheet,'Index',x()+43,y,7.2,true);pdf.link(sheet,x()+43,y-9,35,14,indexDest.get(place.id));
    if(baseURL){const url=new URL(baseURL);url.hash=`map/${data.id}/${place.id}`;pdf.text(sheet,'Open site',x()+91,y,7.2,true);pdf.link(sheet,x()+91,y-9,60,14,url.href,true);}
    y+=12;pdf.line(sheet,x(),y,x()+width,y);y+=19;
    if(i%20===0){onProgress(`Writing full entries ${i+1} / ${entries.length}…`);await new Promise(resolve=>setTimeout(resolve,0));}
  }
}
