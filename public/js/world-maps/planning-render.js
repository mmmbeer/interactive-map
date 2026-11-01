import { traceShape, ringContains } from '../geometry.js';
import { districtColors } from '../district-colors.js';
export function landColor(place,settings) {
  const use=place.worldStyle?.landuse;
  return place.type==='forest'?settings.terrain:['farmland','farmyard'].includes(use)?'#dedfc3':['pasture','meadow','grass','grassland'].includes(use)?'#d5dfc2':['orchard','vineyard'].includes(use)?'#d2dbb6':['cemetery','park','garden'].includes(use)?'#dce4cd':settings.paper;
}
export function drawLandPattern(ctx,place,unit) {
  const shape=place.shape,pts=shape.points,xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y,use=place.worldStyle?.landuse;
  const inside=(x,y)=>ringContains(pts,x,y)&&!(shape.holes||[]).some(r=>ringContains(r,x,y));
  if(['farmland','farmyard','vineyard'].includes(use)) {
    ctx.strokeStyle=use==='vineyard'?'#738c61':'#a5a78c';ctx.lineWidth=unit*.9;
    for(let j=-h;j<w;j+=14*unit){ctx.beginPath();ctx.moveTo(x+j,y);ctx.lineTo(x+j+h,y+h);ctx.stroke();}
  } else if(['orchard','cemetery','pasture','meadow'].includes(use)) {
    const spacing=(use==='orchard'?25:use==='cemetery'?24:42)*unit;let budget=2500;
    ctx.strokeStyle=use==='cemetery'?'#7e8272':'#85956f';ctx.fillStyle='#b1c098';ctx.lineWidth=unit*.8;
    for(let py=y+spacing/2;py<y+h;py+=spacing)for(let px=x+spacing/2;px<x+w;px+=spacing) {
      if(!inside(px,py)||--budget<0)continue;
      ctx.beginPath();
      if(use==='orchard'){ctx.arc(px,py,3.5*unit,0,Math.PI*2);ctx.fill();ctx.stroke();}
      else {const r=use==='cemetery'?3:1.5;ctx.moveTo(px-r*unit,py);ctx.lineTo(px+r*unit,py);ctx.moveTo(px,py-r*unit);ctx.lineTo(px,py+r*unit);ctx.stroke();}
    }
  }
}
export function drawDistrictPreview(ctx,map,scale) {
  const colors=districtColors(map.districts),width=1/scale;
  for(const d of map.districts) {
    const color=colors.get(d.id)?.color||'#b38b45';
    for(const shape of d.boundaries||[]) {
      traceShape(ctx,{shape});ctx.fillStyle=color;ctx.globalAlpha=.12;ctx.fill('evenodd');ctx.globalAlpha=1;
      ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash([4/scale,3/scale]);ctx.stroke();ctx.setLineDash([]);
    }
    if(d.label) {
      ctx.font=`${18/scale}px sans-serif`;ctx.textAlign='center';ctx.lineWidth=3/scale;ctx.strokeStyle='#fffff5';ctx.strokeText(d.name,d.label.x,d.label.y);ctx.fillStyle='#354339';ctx.fillText(d.name,d.label.x,d.label.y);ctx.textAlign='start';
    }
  }
}
