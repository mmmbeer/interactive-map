export const organicOptions={bounds:{west:0,south:0,east:16,north:16},width:1800,height:1800,id:'local-organic-example',name:'Organic settlement',seed:'organic-medieval',regional:true,
  settlement:{type:'city',features:['market','temple','tavern'],landFeatures:['farmland','pasture']}};
const geometry=points=>points.map(([lon,lat])=>({lon,lat}));
export const organicSource={elements:[{type:'relation',id:1,tags:{type:'multipolygon',natural:'water',water:'sea'},members:[
  {type:'way',ref:1,role:'outer',geometry:geometry([[0,0],[16,0],[16,16],[0,16],[0,0]])},
  {type:'way',ref:2,role:'inner',geometry:geometry([[2,3],[7,1.7],[13,3],[14,9],[11,14],[5,13],[1.5,8],[2,3]])}
]}]};
