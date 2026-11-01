const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function calloutPosition(anchor,size,viewport,offset) {
  const margin=12,top=Math.min(62,Math.max(margin,viewport.h-size.h-margin));
  let x,y;
  if(offset) {x=anchor.x+offset.x;y=anchor.y+offset.y;}
  else {
    const right=anchor.x+28,left=anchor.x-size.w-28;
    x=right+size.w<=viewport.w-margin?right:left>=margin?left:(viewport.w-size.w)/2;
    y=anchor.y-size.h*.3;
    if(left<margin && right+size.w>viewport.w-margin) {
      y=anchor.y+28+size.h<=viewport.h-margin?anchor.y+28:anchor.y-size.h-28;
    }
  }
  return {x:clamp(x,margin,Math.max(margin,viewport.w-size.w-margin)),y:clamp(y,top,Math.max(top,viewport.h-size.h-margin))};
}
export function connectorEnd(anchor,box) {
  const cx=box.x+box.w/2,cy=box.y+box.h/2,dx=anchor.x-cx,dy=anchor.y-cy;
  if(Math.abs(dx)<=box.w/2 && Math.abs(dy)<=box.h/2)return null;
  const t=Math.min(dx?box.w/2/Math.abs(dx):Infinity,dy?box.h/2/Math.abs(dy):Infinity);
  return {x:cx+dx*t,y:cy+dy*t};
}
