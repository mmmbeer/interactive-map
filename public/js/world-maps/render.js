import { traceShape, ringContains } from '../geometry.js';
import { hash } from './model.js';
export const DRAGONSGATE={paper:'#eeeae1',water:'#91a6ad',ink:'#202421',terrain:'#d8dccb',roadWidth:1,treeDensity:1,texture:.35,roofDetail:false};
function random(seed) {let n=hash(seed);return ()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
function tree(ctx,x,y,r,ink) {
  ctx.beginPath();
  for(let i=0;i<=10;i++){const a=i*Math.PI/5,d=r*(i%2?.8:1);const px=x+Math.cos(a)*d,py=y+Math.sin(a)*d;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}
  ctx.closePath();ctx.fillStyle='#e6e8db';ctx.fill();ctx.strokeStyle=ink;ctx.stroke();
  ctx.beginPath();ctx.moveTo(x-r*.25,y+r*.15);ctx.lineTo(x+r*.25,y-r*.2);ctx.stroke();
}
export async function renderFantasy(canvas,{map,trees=[]},settings=DRAGONSGATE,{edge=1200,signal}={}) {
  const scale=Math.min(1,edge/Math.max(map.width,map.height));
  canvas.width=Math.round(map.width*scale);canvas.height=Math.round(map.height*scale);
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Your browser could not create the map image. Try a lower resolution.');
  const s={...DRAGONSGATE,...settings},unit=map.width/4096;
  ctx.save();ctx.scale(canvas.width/map.width,canvas.height/map.height);ctx.lineJoin='round';ctx.lineCap='round';
  ctx.fillStyle=s.paper;ctx.fillRect(0,0,map.width,map.height);
  const order={water:0,terrain:1,street:2,home:3},places=[...map.locations].sort((a,b)=>(order[a.category]??3)-(order[b.category]??3));
  let treeBudget=18000;
  try {
    for(const [index,p] of places.entries()) {
      if(index%200===0){signal?.throwIfAborted();await new Promise(r=>setTimeout(r,0));}
      const kind=p.worldStyle?.kind,rand=random(p.id),shape=p.shape;
      ctx.save();traceShape(ctx,p);
      if(p.category==='water') {
        ctx.fillStyle=s.water;ctx.strokeStyle='#596b6e';ctx.lineWidth=unit*.8;
        if(shape.kind==='polyline'){ctx.lineWidth=shape.width;ctx.strokeStyle=s.water;ctx.stroke();}
        else {ctx.fill('evenodd');ctx.stroke();}
      } else if(p.category==='terrain') {
        const forest=p.type==='forest';ctx.fillStyle=forest?s.terrain:s.paper;ctx.fill('evenodd');
        ctx.strokeStyle='#9c9c89';ctx.lineWidth=unit*.5;ctx.stroke();ctx.clip('evenodd');
        const xs=shape.points.map(p=>p[0]),ys=shape.points.map(p=>p[1]),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
        if(forest&&s.treeDensity>0) {
          const count=Math.min(2200,treeBudget,Math.ceil(w*h/(650*unit*unit)*s.treeDensity));ctx.lineWidth=unit*.65;
          for(let j=0;j<count;j++) {
            const tx=x+rand()*w,ty=y+rand()*h;
            if(!ringContains(shape.points,tx,ty)||(shape.holes||[]).some(r=>ringContains(r,tx,ty)))continue;
            tree(ctx,tx,ty,(3+rand()*2)*unit,s.ink);treeBudget--;
          }
        } else if(['farmland','orchard','vineyard'].includes(p.worldStyle?.landuse)) {
          ctx.strokeStyle='#a5a78c';ctx.lineWidth=unit*.6;
          for(let j=-h;j<w;j+=14*unit){ctx.beginPath();ctx.moveTo(x+j,y);ctx.lineTo(x+j+h,y+h);ctx.stroke();}
        }
      } else if(p.category==='street') {
        if(p.worldStyle?.bridge){ctx.strokeStyle=s.ink;ctx.lineWidth=shape.width+unit*2;ctx.stroke();}
        else {ctx.strokeStyle='#a4a18e';ctx.lineWidth=shape.width+unit;ctx.stroke();}
        ctx.strokeStyle='#fbfaf4';ctx.lineWidth=shape.width;ctx.stroke();
      } else if(kind==='building') {
        ctx.fillStyle=s.ink;ctx.strokeStyle='#111813';ctx.lineWidth=unit*.65;ctx.fill('evenodd');ctx.stroke();
        if(s.roofDetail) {
          ctx.clip('evenodd');const pts=shape.points,x=pts.reduce((n,p)=>n+p[0],0)/pts.length,y=pts.reduce((n,p)=>n+p[1],0)/pts.length;
          ctx.strokeStyle='#c1bfb0';ctx.lineWidth=unit*.7;
          ctx.beginPath();ctx.moveTo(x-9*unit,y-4*unit);ctx.lineTo(x+9*unit,y+4*unit);ctx.stroke();
        }
      }ctx.restore();
    }
    if(s.treeDensity>0)for(const [x,y] of trees){ctx.lineWidth=unit*.65;tree(ctx,x,y,4*unit,s.ink);}
    if(s.texture>0) {
      const rand=random(map.generationId);ctx.fillStyle='#252e27';ctx.globalAlpha=s.texture*.12;
      for(let i=0;i<14000;i++){const r=(.25+rand())*unit;ctx.fillRect(rand()*map.width,rand()*map.height,r,r);}
      ctx.globalAlpha=1;
    }
    const font=Math.max(12*unit,12/scale);ctx.font=`${font}px sans-serif`;
    const credit='© OpenStreetMap contributors · ODbL',textWidth=ctx.measureText(credit).width,pad=font*.6;
    ctx.fillStyle='rgba(255,255,250,.94)';ctx.fillRect(map.width-textWidth-pad*2,map.height-font-pad*1.5,textWidth+pad*2,font+pad*1.5);
    ctx.fillStyle='#273531';ctx.fillText(credit,map.width-textWidth-pad,map.height-pad*.6);
  } finally {ctx.restore();}
}
export function canvasBlob(canvas,type='image/png') {
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not encode the image. Try a lower resolution.')),type,.9));
}
export function downloadBlob(blob,filename) {
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
export async function imageFiles(result,settings,signal) {
  const canvas=document.createElement('canvas');await renderFantasy(canvas,result,settings,{edge:Math.max(result.map.width,result.map.height),signal});
  signal?.throwIfAborted();const image=await canvasBlob(canvas),thumbnailCanvas=document.createElement('canvas');
  thumbnailCanvas.width=360;thumbnailCanvas.height=Math.round(360*canvas.height/canvas.width);
  thumbnailCanvas.getContext('2d').drawImage(canvas,0,0,thumbnailCanvas.width,thumbnailCanvas.height);
  const thumbnail=await canvasBlob(thumbnailCanvas,'image/webp');canvas.width=canvas.height=1;
  return {image,thumbnail};
}
