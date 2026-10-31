export const providers = Object.freeze({
  sorrow: {name: 'NPC Sorrow', origin: 'https://sorrow.dndadventurerslog.com'},
  quests: {name: 'D&D Help Board', origin: 'https://help.dndadventurerslog.com'}
});
const burialTypes = new Set(['graveyard','cemetery','necropolis','tomb','crypt','mausoleum','grave']);
const boardTypes = {adventurers_guild:'guild',merchant_guild:'guild',market:'guild',notice_board:'guild',
  watchtower:'watch',barracks:'watch',guardhouse:'watch',college:'college',academy:'college',caravanserai:'roadside'};
export function integrationSettings(place) {
  const saved=place.integrations || {},type=place.type || place.category;
  return {
    sorrow:{enabled:burialTypes.has(type),count:saved.sorrow?.npc?.name?1:['graveyard','cemetery','necropolis'].includes(type)?3:1,...saved.sorrow},
    quests:{enabled:['guild','shop','workshop','tavern','temple','harbor'].includes(place.category) || Object.hasOwn(boardTypes,type),
      level:3,count:6,tone:'Mixed',...saved.quests}
  };
}
// Explicit building functions take precedence over the surrounding landscape.
// Merchant and workshop boards use guild commissions unless local geography selects a regional recipe.
export function boardRecipe(place,context) {
  const type=place.type || place.category;
  if(Object.hasOwn(boardTypes,type))return boardTypes[type];
  if(['tavern','temple','harbor'].includes(place.category))return place.category;
  if(place.category==='guild')return 'guild';
  const environment=context.environment || [];
  if(environment.includes('underground'))return 'underdark';
  if(environment.includes('arid'))return 'desert';
  if(environment.includes('mountain'))return 'mountain';
  if(environment.includes('wetland'))return 'swamp';
  if(environment.includes('woodland'))return 'forest';
  if(environment.includes('hills'))return 'hills';
  if(context.navigable)return 'harbor';
  if(environment.includes('farmland'))return 'grassland';
  if(context.settlementType==='caravan_stop')return 'roadside';
  if(context.settlementType==='fortress')return 'watch';
  if(context.settlementType==='academy')return 'college';
  return 'guild';
}
export function validateIntegrations(value) {
  if(value===undefined)return;
  const object=v=>v && typeof v==='object' && !Array.isArray(v);
  const check=(ok,message)=>{if(!ok)throw new Error(`Connected content: ${message}`);};
  check(object(value),'settings must be an object.');
  check(Object.keys(value).every(k=>Object.hasOwn(providers,k)),'unknown provider.');
  for(const [kind,settings] of Object.entries(value)) {
    check(object(settings),`${kind} settings must be an object.`);
    const keys=kind==='sorrow'?['enabled','count','npc']:['enabled','locationId','level','count','tone'];
    check(Object.keys(settings).every(k=>keys.includes(k)),`unknown ${kind} setting.`);
    if(settings.enabled!==undefined)check(typeof settings.enabled==='boolean','enabled must be a boolean.');
    const integer=(key,min,max)=>{if(settings[key]!==undefined)check(Number.isInteger(settings[key]) && settings[key]>=min && settings[key]<=max,`${key} must be ${min} to ${max}.`);};
    integer('count',kind==='sorrow'?1:6,kind==='sorrow'?6:14);
    if(kind==='quests') {
      integer('level',1,20);
      for(const key of ['tone','locationId'])if(settings[key]!==undefined)check(typeof settings[key]==='string' && /^[a-zA-Z][a-zA-Z0-9_-]{0,59}$/.test(settings[key]),`invalid ${key}.`);
    } else if(settings.npc!==undefined) {
      check(object(settings.npc),'npc must be an object.');
      check(Object.keys(settings.npc).every(k=>['name','race','age','sex','occupation'].includes(k)),'unknown NPC field.');
      for(const [key,v] of Object.entries(settings.npc)) {
        if(key==='age' && typeof v==='number')check(Number.isInteger(v) && v>=0 && v<=2000,'age must be 0 to 2000.');
        else check(typeof v==='string' && v.trim() && v.length<=(key==='name'?48:60) && !/[\u0000-\u001f\u007f]/.test(v),`invalid NPC ${key}.`);
      }
      check(!settings.npc.name || (settings.count ?? 1)===1,'a named NPC requires one story.');
    }
  }
}
