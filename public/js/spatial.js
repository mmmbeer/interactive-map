// Image-space indexing keeps thousands of building hit areas inexpensive to query.
export function buildSpatialIndex(locations, cellSize = 32) {
  const cells = new Map();
  for (const place of locations) {
    const [x,y,w,h] = place.bounds || [place.x-5,place.y-5,10,10];
    for (let gx=Math.floor(x/cellSize);gx<=Math.floor((x+w)/cellSize);gx++) {
      for (let gy=Math.floor(y/cellSize);gy<=Math.floor((y+h)/cellSize);gy++) {
        const key=`${gx},${gy}`;
        if (!cells.has(key)) cells.set(key,[]);
        cells.get(key).push(place);
      }
    }
  }
  return {cells,cellSize,featured:locations.filter(p=>p.featured)};
}
export function hitTest(index,locations,x,y,scale=1,predicate=()=>true,markers=true) {
  if (markers) {
    let nearest=null, distance=18/scale;
    for (const p of index.featured) {
      if (!predicate(p)) continue;
      const d=Math.hypot(p.x-x,p.y-y);
      if (d<distance) { nearest=p; distance=d; }
    }
    if (nearest) return nearest;
  }
  const candidates=index.cells.get(`${Math.floor(x/index.cellSize)},${Math.floor(y/index.cellSize)}`)||[];
  return candidates.filter(p=>{
    if (!predicate(p)) return false;
    const [bx,by,w,h]=p.bounds||[p.x-5,p.y-5,10,10];
    return x>=bx&&x<=bx+w&&y>=by&&y<=by+h;
  }).sort((a,b)=>{
    const area=p=>p.bounds ? p.bounds[2]*p.bounds[3] : 100;
    return area(a)-area(b);
  })[0]||null;
}
export function matches(place,{query='',category='',district=''}={}) {
  return (!category||place.category===category)&&(!district||place.district===district)&&
    (!query||[place.name,place.district,place.description,place.person,place.address].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase()));
}
