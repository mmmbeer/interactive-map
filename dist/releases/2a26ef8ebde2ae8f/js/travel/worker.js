import { buildRoadGraph } from './graph.js';
import { roadRoute } from './routing.js';
let roads,graph,tolerance;
self.onmessage=({data})=>{
  try {
    if(data.roads){roads=data.roads;graph=null;}
    if(!graph || tolerance!==data.tolerance){tolerance=data.tolerance;graph=buildRoadGraph(roads,{joinTolerance:tolerance});}
    self.postMessage({id:data.id,result:roadRoute(graph,data.points,{maxSnapDistance:data.maxSnapDistance})});
  }catch(error){self.postMessage({id:data.id,error:error.message});}
};
