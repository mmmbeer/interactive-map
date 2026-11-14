import { materializeMap } from './generation/locations.js';
import { searchPlaces } from './spatial.js';
let map,version=0;
self.onmessage=async({data})=>{
  const id=version=data.id;
  if(!data.filters)return;
  try {
    if(data.map)map=materializeMap(data.map);
    const results=await searchPlaces(map.locations,data.filters,{batchSize:20,current:()=>version===id});
    if(results&&version===id)self.postMessage({id,ids:results.map(p=>p.id)});
  } catch(error) {if(version===id)self.postMessage({id,error:error.message});}
};
