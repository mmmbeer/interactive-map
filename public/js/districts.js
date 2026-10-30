import { check } from './generation/validate.js';
import { traceShape } from './geometry.js';
const colors=['#ffc15e','#89c8d7','#b3caa0','#d9b0ce','#b5b2e8','#f3c099','#85c6b8'];
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
    this.canvas=document.createElement('canvas');this.canvas.className='map-district-overlay';
    this.canvas.width=data.width;this.canvas.height=data.height;world.querySelector('.map-image').after(this.canvas);
    this.ctx=this.canvas.getContext('2d');
  }
  draw(scale,selected='') {
    const ctx=this.ctx;ctx.clearRect(0,0,this.data.width,this.data.height);
    if(!this.enabled)return;
    this.districts.forEach((d,i)=>{
      const active=selected===d.name,color=colors[i%colors.length];
      for(const shape of d.boundaries) {
        traceShape(ctx,{shape});ctx.fillStyle=color+(active?'44':'12');ctx.fill();
        ctx.strokeStyle='#08035788';ctx.lineWidth=(active?4:2.5)/scale;
        ctx.setLineDash([5/scale,3/scale]);ctx.stroke();
        ctx.strokeStyle=active?'#080357':color;ctx.lineWidth=(active?2:1.2)/scale;
        ctx.setLineDash([5/scale,3/scale]);ctx.stroke();
      }
    });ctx.setLineDash([]);
  }
  toggle(scale,selected) {this.enabled=!this.enabled;this.draw(scale,selected);return this.enabled;}
}
