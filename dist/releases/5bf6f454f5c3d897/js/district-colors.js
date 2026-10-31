import { boundsFor, contains, distanceToPath } from './geometry.js';
const rings=shape=>[shape.points,...(shape.holes||[])];
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function nearSegments(a,b,c,d,tolerance) {
  if(Math.max(a[0],b[0])+tolerance<Math.min(c[0],d[0]) || Math.max(c[0],d[0])+tolerance<Math.min(a[0],b[0]) || Math.max(a[1],b[1])+tolerance<Math.min(c[1],d[1]) || Math.max(c[1],d[1])+tolerance<Math.min(a[1],b[1]))return false;
  if(cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0)return true;
  return Math.min(distanceToPath([a,b],...c),distanceToPath([a,b],...d),distanceToPath([c,d],...a),distanceToPath([c,d],...b))<=tolerance;
}
export function districtsAdjacent(a,b,tolerance=2) {
  for(const sa of a.boundaries||[])for(const sb of b.boundaries||[]) {
    const [ax,ay,aw,ah]=boundsFor({shape:sa}),[bx,by,bw,bh]=boundsFor({shape:sb});
    if(ax+aw+tolerance<bx || bx+bw+tolerance<ax || ay+ah+tolerance<by || by+bh+tolerance<ay)continue;
    if(sa.points.some(([x,y])=>contains({shape:sb},x,y)) || sb.points.some(([x,y])=>contains({shape:sa},x,y)))return true;
    for(const ra of rings(sa))for(const rb of rings(sb))for(let i=0;i<ra.length;i++)for(let j=0;j<rb.length;j++) {
      if(nearSegments(ra[i],ra[(i+1)%ra.length],rb[j],rb[(j+1)%rb.length],tolerance))return true;
    }
  }
  return false;
}
export function districtAdjacency(districts) {
  const boxes=districts.flatMap(d=>(d.boundaries||[]).map(shape=>boundsFor({shape})));
  const span=axis=>Math.max(...boxes.map(b=>b[axis]+b[axis+2]))-Math.min(...boxes.map(b=>b[axis]));
  // Streets can leave a narrow gap between authored district polygons.
  const tolerance=boxes.length?Math.min(span(0),span(1))*.012:0;
  const graph=new Map(districts.map(d=>[d.id,new Set()]));
  for(let i=0;i<districts.length;i++)for(let j=0;j<i;j++)if(districtsAdjacent(districts[i],districts[j],tolerance)) {
    graph.get(districts[i].id).add(districts[j].id);graph.get(districts[j].id).add(districts[i].id);
  }
  return graph;
}
function colorFamilies(graph,count) {
  const ids=[...graph.keys()].sort(),assigned=new Map(),usage=Array(count).fill(0);let budget=50000;
  function visit() {
    if(assigned.size===ids.length)return true;
    if(--budget<0)return false;
    const candidates=ids.filter(id=>!assigned.has(id)).map(id=>({id,used:new Set([...graph.get(id)].map(n=>assigned.get(n)).filter(n=>n!==undefined))}));
    candidates.sort((a,b)=>b.used.size-a.used.size || graph.get(b.id).size-graph.get(a.id).size || (a.id<b.id?-1:a.id>b.id?1:0));
    const next=candidates[0],choices=usage.map((used,family)=>({used,family})).filter(c=>!next.used.has(c.family)).sort((a,b)=>a.used-b.used||a.family-b.family);
    for(const {family} of choices){assigned.set(next.id,family);usage[family]++;if(visit())return true;usage[family]--;assigned.delete(next.id);}
    return false;
  }
  return visit()?assigned:null;
}
function hexColor(hue,saturation,lightness) {
  const s=saturation/100,l=lightness/100,c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((hue/60)%2-1)),m=l-c/2;
  const parts=hue<60?[c,x,0]:hue<120?[x,c,0]:hue<180?[0,c,x]:hue<240?[0,x,c]:hue<300?[x,0,c]:[c,0,x];
  return '#'+parts.map(n=>Math.round((n+m)*255).toString(16).padStart(2,'0')).join('');
}
function uniqueHues(graph) {
  const ids=[...graph.keys()].sort(),assigned=new Map(),used=new Set(),count=ids.length;let budget=60000;
  const hue=slot=>(24+slot*360/count)%360;
  const distance=(a,b)=>{const d=Math.abs(hue(a)-hue(b));return Math.min(d,360-d);};
  function options(id) {return Array.from({length:count},(_,i)=>i).filter(slot=>!used.has(slot) && [...graph.get(id)].every(n=>!assigned.has(n) || distance(slot,assigned.get(n))>=60-1e-8));}
  function visit() {
    if(assigned.size===count)return true;
    if(--budget<0)return false;
    const remaining=ids.filter(id=>!assigned.has(id)).map(id=>({id,choices:options(id)}));
    remaining.sort((a,b)=>a.choices.length-b.choices.length || graph.get(b.id).size-graph.get(a.id).size || (a.id<b.id?-1:a.id>b.id?1:0));
    const {id,choices}=remaining[0];if(!choices.length)return false;
    const score=slot=>Math.min(180,...[...graph.get(id)].filter(n=>assigned.has(n)).map(n=>distance(slot,assigned.get(n))));
    choices.sort((a,b)=>score(b)-score(a)||a-b);
    for(const slot of choices){assigned.set(id,slot);used.add(slot);if(visit())return true;assigned.delete(id);used.delete(slot);}
    return false;
  }
  return visit()?new Map([...assigned].map(([id,slot])=>[id,{hue:hue(slot),slot}])):null;
}
export function districtColors(districts) {
  const graph=districtAdjacency(districts),unique=uniqueHues(graph);
  if(unique)return new Map([...unique].map(([id,{hue,slot}])=>[id,{color:hexColor(hue,65+(slot%3)*6,40+(slot%2)*8),hue,family:slot}]));
  let families,count=4;
  while(count<=Math.max(4,districts.length) && !(families=colorFamilies(graph,count)))count++;
  const palette=new Map(),used=new Set(),bases=count===4?[24,204,114,294]:Array.from({length:count},(_,i)=>24+i*360/count);
  for(let family=0;family<count;family++) {
    const ids=[...graph.keys()].filter(id=>families.get(id)===family).sort();
    ids.forEach((id,i)=>{
      const spread=Math.min(16,Math.max(0,360/count-60)),offset=ids.length>1?(i/(ids.length-1)-.5)*spread:0,hue=(bases[family]+offset+360)%360;
      let lightness=38+(i%3)*9,color=hexColor(hue,67+(i%2)*7,lightness);
      while(used.has(color)){lightness+=.25;color=hexColor(hue,67+(i%2)*7,lightness);}
      used.add(color);palette.set(id,{color,hue,family});
    });
  }
  return palette;
}
