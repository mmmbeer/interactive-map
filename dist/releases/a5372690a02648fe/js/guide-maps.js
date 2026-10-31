// Partition dense maps into linked detail sheets instead of overprinting tiny sites.
export function mapSheets(data,places,maxSites=65) {
  const sheets=[];
  function split(box,items,depth=0) {
    if(!items.length)return;
    const scale=Math.min(516/box.w,598/box.h);
    let crowded=items.length>maxSites;
    if(!crowded)for(let i=0;i<items.length && !crowded;i++)for(let j=0;j<i;j++) {
      if(Math.abs(items[i].x-items[j].x)*scale<34 && Math.abs(items[i].y-items[j].y)*scale<17){crowded=true;break;}
    }
    if(!crowded || depth>=12 || box.w<2 || box.h<2) {sheets.push({...box,places:items});return;}
    const axis=box.w/516>box.h/598?'x':'y',size=axis==='x'?'w':'h',mid=box[axis]+box[size]/2;
    split({...box,[size]:box[size]/2},items.filter(p=>p[axis]<mid),depth+1);
    split({...box,[axis]:mid,[size]:box[size]/2},items.filter(p=>p[axis]>=mid),depth+1);
  }
  split({x:0,y:0,w:data.width,h:data.height},places);
  return sheets;
}
export function drawMap(pdf,page,data,box,imageRect) {
  const {x,y,w,h}=imageRect,scale=Math.min(w/box.w,h/box.h),left=x+(w-box.w*scale)/2,top=y+(h-box.h*scale)/2;
  page.commands.push(`q ${left} ${792-top-box.h*scale} ${box.w*scale} ${box.h*scale} re W n ${data.width*scale} 0 0 ${data.height*scale} ${left-box.x*scale} ${792-top-(data.height-box.y)*scale} cm /Map Do Q`);
  return p=>({x:left+(p.x-box.x)*scale,y:top+(p.y-box.y)*scale});
}
export function mapBadge(pdf,page,number,point,dest,occupied=[]) {
  const w=Math.max(19,pdf.bold.measure(String(number),8)+8),h=15;
  let x=point.x-w/2,y=point.y-h/2;
  for(let tries=0;tries<80 && occupied.some(r=>x<r.x+r.w+2&&x+w+2>r.x&&y<r.y+r.h+2&&y+h+2>r.y);tries++) {
    const angle=tries*2.4,radius=4*Math.sqrt(tries+1);x=Math.max(48,Math.min(564-w,point.x-w/2+Math.cos(angle)*radius));y=Math.max(94,Math.min(720-h,point.y-h/2+Math.sin(angle)*radius));
  }
  if(Math.hypot(x+w/2-point.x,y+h/2-point.y)>8)pdf.line(page,point.x,point.y,x+w/2,y+h/2);
  pdf.rect(page,x,y,w,h,'0.03 0.01 0.34');pdf.text(page,String(number),x+4,y+10.5,8,true,'0.96 1 0.56');
  pdf.link(page,x,y,w,h,dest);occupied.push({x,y,w,h});
}
