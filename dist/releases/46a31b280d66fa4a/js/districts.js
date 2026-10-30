import { check } from './generation/validate.js';
import { districtColors } from './district-colors.js';
import { contains, traceShape } from './geometry.js';
export function hitTestDistrict(districts,x,y,{enabled=true,object=null}={}) {
  if(!enabled || object)return null;
  return districts.find(d=>(d.boundaries||[]).some(shape=>contains({shape},x,y))) || null;
}
export function validateDistrictGeometry(d,map) {
  const point=p=>Array.isArray(p) && p.length===2 && p.every(Number.isFinite) && p[0]>=0 && p[0]<=map.width && p[1]>=0 && p[1]<=map.height;
  if(d.label!==undefined) check(d.label && point([d.label.x,d.label.y]),`${d.id}: invalid district label.`);
  if(d.boundaries===undefined)return;
  check(Array.isArray(d.boundaries) && d.boundaries.length>0,`${d.id}: district boundaries must be a nonempty list.`);
  for(const shape of d.boundaries) {
    check(shape?.kind==='polygon' && Array.isArray(shape.points) && shape.points.length>=3 && shape.points.every(point),`${d.id}: invalid district boundary polygon.`);
    const area=shape.points.reduce((sum,[x,y],i)=>{const [nx,ny]=shape.points[(i+1)%shape.points.length];return sum+x*ny-nx*y;},0);
    check(Math.abs(area)>0,`${d.id}: district boundary has no area.`);
  }
}
export class DistrictLayer {
  constructor(world,data) {
    this.data=data;this.enabled=true;
    this.districts=(data.districtAreas || data.districts || []).filter(d=>typeof d==='object' && d.boundaries?.length);
    const palette=districtColors(this.districts);this.districts=this.districts.map(d=>({...d,...palette.get(d.id)}));
    this.canvas=document.createElement('canvas');this.canvas.className='map-district-overlay';
    this.canvas.width=data.width;this.canvas.height=data.height;world.querySelector('.map-image').after(this.canvas);
    this.ctx=this.canvas.getContext('2d');
  }
  draw(scale,selected='',hovered='') {
    if(this.lastScale===scale && this.lastSelected===selected && this.lastEnabled===this.enabled && this.lastHovered===hovered)return;
    this.lastScale=scale;this.lastSelected=selected;this.lastEnabled=this.enabled;this.lastHovered=hovered;
    const ctx=this.ctx;
    this.canvas.classList.toggle('layer-off',!this.enabled);
    if(!this.enabled)return;
    ctx.clearRect(0,0,this.data.width,this.data.height);
    this.districts.forEach(d=>{
      const active=selected===d.name,color=d.color,over=hovered===d.id;
      for(const shape of d.boundaries) {
        traceShape(ctx,{shape});ctx.fillStyle=color;ctx.globalAlpha=active ? .22 : over ? .20 : .14;ctx.fill('evenodd');ctx.globalAlpha=1;
        ctx.strokeStyle='#08035750';ctx.lineWidth=(active||over?3:2)/scale;
        ctx.setLineDash([5/scale,3/scale]);ctx.stroke();
        ctx.strokeStyle=color;ctx.lineWidth=(active||over?1.8:1)/scale;
        ctx.setLineDash([5/scale,3/scale]);ctx.stroke();
      }
    });ctx.setLineDash([]);
  }
  toggle(scale,selected) {this.enabled=!this.enabled;this.draw(scale,selected);return this.enabled;}
}
