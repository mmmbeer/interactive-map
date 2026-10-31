// Bounded, dependency-free raster primitives shared by the worker and tests.
export function components(mask,w,h,min=1) {
  const labels=new Int32Array(mask.length),queue=new Int32Array(mask.length),items=[];
  let id=0;
  for(let start=0;start<mask.length;start++) {
    if(!mask[start] || labels[start])continue;
    const item={id:++id,size:0,x:0,y:0,left:w,top:h,right:0,bottom:0};
    let head=0,tail=1;queue[0]=start;labels[start]=id;
    while(head<tail) {
      const p=queue[head++],x=p%w,y=Math.floor(p/w);
      item.size++;item.x+=x;item.y+=y;
      item.left=Math.min(item.left,x);item.right=Math.max(item.right,x);
      item.top=Math.min(item.top,y);item.bottom=Math.max(item.bottom,y);
      for(const q of [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1]) {
        if(q>=0 && mask[q] && !labels[q]){labels[q]=id;queue[tail++]=q;}
      }
    }
    item.x/=item.size;item.y/=item.size;
    if(item.size>=min)items.push(item);
  }
  return {labels,items};
}
export function simplify(points,tolerance=1) {
  if(points.length<=2)return points;
  const keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;
  const stack=[[0,points.length-1]];
  while(stack.length) {
    const [a,b]=stack.pop(),[ax,ay]=points[a],[bx,by]=points[b],dx=bx-ax,dy=by-ay;
    let max=tolerance*tolerance,at=-1;
    for(let i=a+1;i<b;i++) {
      const [x,y]=points[i],t=dx||dy?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy))):0;
      const d=(x-ax-t*dx)**2+(y-ay-t*dy)**2;
      if(d>max){max=d;at=i;}
    }
    if(at!==-1){keep[at]=1;stack.push([a,at],[at,b]);}
  }
  return points.filter((_,i)=>keep[i]);
}
export const area=ring=>ring.reduce((sum,[x,y],i)=>{const [nx,ny]=ring[(i+1)%ring.length];return sum+x*ny-nx*y;},0)/2;
export function outline(labels,w,h,item,sx=1,sy=1) {
  const edges=new Map(),stride=w+1,id=item.id;
  const add=(x,y,nx,ny)=>{
    const key=y*stride+x;if(!edges.has(key))edges.set(key,[]);edges.get(key).push(ny*stride+nx);
  };
  for(let y=item.top;y<=item.bottom;y++)for(let x=item.left;x<=item.right;x++) {
    const p=y*w+x;if(labels[p]!==id)continue;
    if(!y || labels[p-w]!==id)add(x,y,x+1,y);
    if(x===w-1 || labels[p+1]!==id)add(x+1,y,x+1,y+1);
    if(y===h-1 || labels[p+w]!==id)add(x+1,y+1,x,y+1);
    if(!x || labels[p-1]!==id)add(x,y+1,x,y);
  }
  const rings=[];
  while(edges.size) {
    const start=edges.keys().next().value,ring=[];let key=start;
    do {
      ring.push([key%stride,Math.floor(key/stride)]);
      const options=edges.get(key);if(!options)break;
      const next=options.pop();if(!options.length)edges.delete(key);key=next;
    }while(key!==start);
    if(key===start && ring.length>=4) {
      ring.push(ring[0]);
      const points=simplify(ring,0.7).slice(0,-1).map(([x,y])=>[x*sx,y*sy]);
      if(points.length>=3 && Math.abs(area(points))>0)rings.push(points);
    }
  }
  rings.sort((a,b)=>Math.abs(area(b))-Math.abs(area(a)));
  return rings;
}
export function skeleton(mask,w,h) {
  const result=mask.slice(),remove=[];
  // Zhang-Suen thinning. A fixed pass budget bounds unusual solid-color inputs.
  for(let pass=0;pass<80;pass++) {
    let changed=0;
    for(let phase=0;phase<2;phase++) {
      remove.length=0;
      for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++) {
        const p=y*w+x;if(!result[p])continue;
        const n=[p-w,p-w+1,p+1,p+w+1,p+w,p+w-1,p-1,p-w-1].map(q=>result[q]);
        const count=n.reduce((a,b)=>a+b,0);if(count<2 || count>6)continue;
        let transitions=0;for(let j=0;j<8;j++)if(!n[j] && n[(j+1)%8])transitions++;
        if(transitions!==1)continue;
        const a=phase?n[0]*n[2]*n[6]:n[0]*n[2]*n[4],b=phase?n[0]*n[4]*n[6]:n[2]*n[4]*n[6];
        if(!a && !b)remove.push(p);
      }
      remove.forEach(p=>result[p]=0);changed+=remove.length;
    }
    if(!changed)break;
  }
  return result;
}
export function paths(mask,w,h) {
  const neighbors=p=>{
    const x=p%w,y=Math.floor(p/w),out=[];
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
      if(!(dx||dy) || x+dx<0 || x+dx>=w || y+dy<0 || y+dy>=h)continue;
      // Suppress diagonal shortcuts around an existing orthogonal connection.
      if(dx && dy && (mask[p+dx] || mask[p+dy*w]))continue;
      const q=p+dy*w+dx;if(mask[q])out.push(q);
    }
    return out;
  };
  const visited=new Set(),out=[],edge=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
  const trace=start=>{
    for(const next of neighbors(start)) {
      if(visited.has(edge(start,next)))continue;
      let prev=start,p=next;const path=[start];visited.add(edge(prev,p));
      while(true) {
        path.push(p);const ns=neighbors(p);if(ns.length!==2 || p===start)break;
        const q=ns.find(n=>n!==prev);if(visited.has(edge(p,q)))break;
        visited.add(edge(p,q));prev=p;p=q;
      }
      if(path.length>=5)out.push(simplify(path.map(p=>[p%w+0.5,Math.floor(p/w)+0.5]),1));
    }
  };
  for(let p=0;p<mask.length;p++)if(mask[p] && neighbors(p).length!==2)trace(p);
  for(let p=0;p<mask.length;p++)if(mask[p])trace(p); // Closed loops have no endpoints.
  return out;
}
