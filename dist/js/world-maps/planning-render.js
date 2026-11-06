import { traceShape } from '../geometry.js';
import { districtColors } from '../district-colors.js';
import { seededRandom, biomeFor } from './decoration-plan.js';
export function landColor(place,settings) {
  const use=place.worldStyle?.landuse,biome=biomeFor(place);
  return biome==='wetland'?'#cad8ce':place.type==='forest'?settings.terrain:['farmland','farmyard'].includes(use)?'#dedfc3':['pasture','meadow','grass','grassland'].includes(use)?'#d5dfc2':['orchard','vineyard'].includes(use)?'#d2dbb6':['cemetery','park','garden'].includes(use)?'#dce4cd':settings.paper;
}
export function drawLandPattern(ctx,place,unit,settings) {
  const pts=place.shape.points,xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
  const use=place.worldStyle?.landuse,rand=seededRandom(`${place.id}:wash-v1`);
  // Soft patches vary the land wash. The caller clips all marks to the parcel.
  ctx.save();ctx.fillStyle=settings.ink;ctx.globalAlpha=.025;
  for(let i=0;i<8;i++) {
    ctx.beginPath();ctx.ellipse(x+rand()*w,y+rand()*h,(.08+rand()*.18)*w,(.08+rand()*.18)*h,rand()*Math.PI,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
  if(!['farmland','farmyard','vineyard'].includes(use))return;
  ctx.strokeStyle=use==='vineyard'?'#738c61':'#a5a78c';ctx.lineWidth=unit*.8;
  for(let j=-h;j<w;j+=(12+rand()*5)*unit) {
    const drift=(rand()-.5)*5*unit;
    ctx.beginPath();ctx.moveTo(x+j,y);ctx.bezierCurveTo(x+j+h*.33+drift,y+h*.33,x+j+h*.66-drift,y+h*.66,x+j+h,y+h);ctx.stroke();
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
