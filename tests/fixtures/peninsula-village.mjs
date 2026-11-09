export const peninsulaOptions={bounds:{west:0,south:0,east:16,north:16},width:1800,height:1800,id:'local-peninsula-example',name:'Peninsula village',seed:'peninsula-village',regional:true,
  settlement:{type:'village',features:['market','temple','tavern'],landFeatures:['pasture']}};
const geometry=points=>points.map(([lon,lat])=>({lon,lat}));
// A narrow northern spit widens into a village site, with an inlet on its east.
export const peninsulaSource={elements:[{type:'way',id:1,tags:{natural:'water',water:'sea'},geometry:geometry([
  [0,0],[3,0],[2.6,2.3],[3.2,4.2],[4.2,6.3],[5.3,8.1],[5.9,10.2],[6.1,12.5],[6.8,14.9],[7.6,16],
  [8.5,16],[8.1,13.9],[8.8,12.2],[10.7,10.7],[12.8,10.1],[14.1,10.9],[16,10.5],[16,16],[0,16],[0,0]
])}]};
