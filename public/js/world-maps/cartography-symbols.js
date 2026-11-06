// Kenney Cartography Pack (2020), CC0. See assets/cartography/LICENSE.txt.
// Bundle locally: exports never depend on third-party images or taint the canvas.
export const symbolFrames={
  pine:[301,30,46,92],pineLarge:[158,1174,68,100],pines:[14,1157,100,117],
  broadleaf:[38,749,62,141],bush:[934,1214,52,60],
  rocks:[389,910,117,108],rocksLow:[390,805,116,85],
  graves:[653,1094,102,52],ship:[387,262,120,117],ripples:[263,775,114,115],
};
let imagePromise;
function loadImage() {
  if(!imagePromise)imagePromise=new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>resolve(image);
    image.onerror=()=>{imagePromise=undefined;reject(new Error('Map symbols could not load. Try creating the preview again.'));};
    image.src=new URL('assets/cartography/kenney-ink-v1.png',document.baseURI).href;
  });
  return imagePromise;
}
export async function loadSymbols(ink,signal) {
  signal?.throwIfAborted();
  const source=await new Promise((resolve,reject)=>{
    const abort=()=>{signal.removeEventListener('abort',abort);reject(signal.reason);};
    signal?.addEventListener('abort',abort,{once:true});
    loadImage().then(value=>{signal?.removeEventListener('abort',abort);resolve(value);},error=>{signal?.removeEventListener('abort',abort);reject(error);});
  });
  signal?.throwIfAborted();
  const atlas=document.createElement('canvas');atlas.width=source.width;atlas.height=source.height;
  const ctx=atlas.getContext('2d');
  if(!ctx)throw new Error('Your browser could not prepare map symbols. Try a lower resolution.');
  ctx.drawImage(source,0,0);ctx.globalCompositeOperation='source-in';ctx.fillStyle=ink;ctx.fillRect(0,0,atlas.width,atlas.height);
  return atlas;
}
export function drawSymbol(ctx,atlas,mark) {
  const {x,y,size,angle=0,flip=1,kind}=mark;
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(flip,1);
  if(kind==='grass'||kind==='reeds') {
    ctx.lineWidth=size*.045;ctx.beginPath();
    ctx.moveTo(-size*.25,size*.2);ctx.quadraticCurveTo(-size*.24,-size*.05,-size*.4,-size*.2);
    ctx.moveTo(0,size*.2);ctx.quadraticCurveTo(size*.1,-size*.1,0,-size*.4);
    ctx.moveTo(size*.2,size*.2);ctx.quadraticCurveTo(size*.16,0,size*.36,-size*.13);ctx.stroke();
    if(kind==='reeds') {
      ctx.lineWidth=size*.11;ctx.beginPath();ctx.moveTo(0,-size*.28);ctx.lineTo(0,-size*.45);ctx.stroke();
      ctx.lineWidth=size*.04;ctx.beginPath();ctx.moveTo(-size*.45,size*.36);ctx.quadraticCurveTo(0,size*.24,size*.46,size*.35);ctx.stroke();
    }
  } else {
    const frame=symbolFrames[kind];
    if(frame) {
      const scale=size/Math.max(frame[2],frame[3]),w=frame[2]*scale,h=frame[3]*scale;
      ctx.drawImage(atlas,...frame,-w/2,-h/2,w,h);
    }
  }
  ctx.restore();
}
