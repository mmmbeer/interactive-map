const area=(id,type,use,points,holes=[])=>({id,type,category:type==='cemetery'?'landmark':'terrain',x:points[0][0],y:points[0][1],shape:{kind:'polygon',points,holes},worldStyle:{kind:'terrain',landuse:use}});
export function cartographyMap() {
  return {id:'cartography-review',generationId:'ink-review',width:4096,height:3072,generator:{seed:'forest-harbor-7'},locations:[
    area('wood','forest','wood',[[80,100],[1400,80],[1600,850],[1230,1300],[150,1200]],[[[500,400],[900,400],[900,750],[500,750]]]),
    area('marsh','marsh','wetland',[[110,1450],[1150,1420],[1430,1740],[1300,2350],[180,2390]]),
    area('cemetery','cemetery','cemetery',[[1740,120],[2350,100],[2390,780],[1720,850]]),
    area('orchard','orchard','orchard',[[2670,100],[3190,150],[3270,790],[2640,870]]),
    area('farm','farmland','farmland',[[2650,970],[3240,920],[3350,1520],[2720,1600]]),
    area('pasture','pasture','pasture',[[2650,1730],[3200,1650],[3310,2320],[2720,2440]]),
    {id:'river',category:'water',type:'river',x:3550,y:1500,shape:{kind:'polygon',points:[[3370,0],[4096,0],[4096,3072],[3350,3072],[3410,2650],[3590,2180],[3440,1720],[3530,1330],[3390,750]]}},
    {id:'road',category:'street',type:'street',x:1600,y:1500,shape:{kind:'polyline',width:22,points:[[0,1320],[600,1300],[1400,1250],[1610,950],[1600,0]]}},
    {id:'lane',category:'street',type:'street',x:1600,y:1500,shape:{kind:'polyline',width:18,points:[[1600,3072],[1560,2140],[1630,1470],[2400,1440],[3380,1550]]}},
    {id:'harbor',category:'harbor',type:'harbor',x:3350,y:1520,shape:{kind:'polygon',points:[[3320,1490],[3380,1490],[3390,1560],[3320,1550]]},worldStyle:{kind:'building',established:true}},
    ...Array.from({length:18},(_,i)=>{
      const x=1700+i%4*140,y=1560+Math.floor(i/4)*145;
      return {id:`home-${i}`,category:'home',type:'home',x,y,shape:{kind:'polygon',points:[[x,y],[x+65,y+5],[x+60,y+75],[x-5,y+70]]},worldStyle:{kind:'building'}};
    }),
    {id:'forest-roof',category:'home',type:'home',x:1100,y:700,shape:{kind:'polygon',points:[[1080,660],[1160,660],[1160,740],[1080,740]]},worldStyle:{kind:'building'}},
    {id:'forest-lane',category:'street',type:'trail',x:1000,y:1000,shape:{kind:'polyline',width:10,points:[[0,250],[1500,1100]]}},
    {id:'forest-pond',category:'water',type:'pond',x:1150,y:340,shape:{kind:'polygon',points:[[1000,210],[1240,200],[1290,400],[1130,470],[1010,360]]}},
  ]};
}
