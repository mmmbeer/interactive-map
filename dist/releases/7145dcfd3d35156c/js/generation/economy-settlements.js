const profile=(label,scale,sectors,resources,customers)=>({label,scale,industries:sectors.split('|'),resources:resources ? resources.split('|') : [],customers:customers.split('|')});
export const settlementTypes = {
  hamlet:profile('hamlet',1,'agriculture|food|wood|civic','', 'neighboring households|farm tenants|passing carriers|garden keepers|local cooks|repair customers|seasonal workers|smallholders|visiting relatives|market-day travelers'),
  village:profile('village',1,'agriculture|food|wood|textiles|leather','', 'village households|farm stewards|market sellers|local builders|visiting carriers|gardeners|herders|innkeepers|seasonal workers|parish stewards'),
  town:profile('town',2,'commerce|food|transport|wood|metal','', 'town households|market stallholders|guild buyers|travelers|carriers|local builders|teachers|innkeepers|estate clerks|visiting traders'),
  city:profile('city',3,'commerce|records|arts|textiles|metal','', 'city households|district stewards|guild buyers|shopkeepers|visiting merchants|builders|teachers|estate clerks|performers|travelers'),
  metropolis:profile('metropolis',4,'commerce|records|learning|arcane|arts','', 'civic institutions|merchant houses|specialist guilds|urban households|visiting delegations|collectors|scholars|performance companies|estate offices|regional factors'),
  port:profile('port',3,'maritime|transport|commerce|food|textiles','', 'ship crews|dockworkers|harbor factors|visiting merchants|pilots|quay households|fish sellers|sail lofts|ferry keepers|cargo clerks'),
  mining_outpost:profile('mining outpost',1,'metal|stone|transport|food|leather','ore|stone|coal', 'mine crews|assayers|ore carriers|shaft carpenters|tool keepers|surveyors|outpost households|camp cooks|supply factors|watch crews'),
  forest_hold:profile('forest hold',1,'wood|agriculture|medicine|textiles|arts','timber|willow|herbs', 'foresters|woodland households|timber carriers|herb gatherers|trail keepers|carvers|garden stewards|charcoal crews|visiting traders|forest wardens'),
  farming_village:profile('farming village',1,'agriculture|food|wood|leather|textiles','grain|farmland|pasture|fruit|livestock|wool|flax', 'farm tenants|grain buyers|harvest crews|millers|orchard keepers|herders|dairy households|seed sellers|market carriers|village cooks'),
  fortress:profile('fortress',2,'metal|transport|leather|food|civic','', 'watch crews|quartermasters|armor keepers|garrison cooks|messengers|supply carriers|gate wardens|fortress households|engineers|stable hands'),
  monastery:profile('monastery settlement',1,'records|agriculture|medicine|food|arts','', 'pilgrims|archivists|garden keepers|copyists|visiting scholars|household stewards|guesthouse keepers|temple servants|travelers|estate clerks'),
  academy:profile('academy settlement',2,'learning|records|arcane|glass|arts','', 'students|tutors|researchers|laboratory keepers|copyists|visiting scholars|instrument makers|librarians|academy stewards|resident households'),
  caravan_stop:profile('caravan stop',1,'transport|commerce|leather|food|hospitality','', 'caravan crews|pack handlers|traveling traders|couriers|wagon keepers|camp cooks|guide companies|supply factors|passing pilgrims|resident households'),
  undercity:profile('underground settlement',2,'stone|metal|glass|commerce|food','stone', 'tunnel wardens|underground households|lamp keepers|ventilation crews|stone carriers|surveyors|market sellers|supply factors|couriers|cistern keepers')
};
export const resourceKeys = [...new Set(Object.values(settlementTypes).flatMap(p=>p.resources).concat('grain fruit herbs livestock wool flax hemp silk hides timber willow reed ore iron copper coal stone clay sand quartz ash fish silver honey oil paper pigments cloth farmland pasture orchard'.split(' ')))];
export const environmentKeys = ['coastal','river','lake','woodland','hills','mountain','wetland','farmland','underground','arid'];
export function validateSettlement(value,check,prefix='Settlement') {
  check(value && typeof value==='object' && !Array.isArray(value),`${prefix}: settlement must be an object.`);
  check(Object.keys(value).every(k=>['type','resources','industries','environment'].includes(k)),`${prefix}: unknown settlement setting.`);
  if (value.type!==undefined) check(Object.hasOwn(settlementTypes,value.type),`${prefix}: unknown settlement type.`);
  const allowed={resources:resourceKeys,industries:'agriculture food textiles leather wood metal stone glass maritime transport records learning arcane medicine hospitality arts commerce civic'.split(' '),environment:environmentKeys};
  for (const [key,keys] of Object.entries(allowed)) if(value[key]!==undefined) check(Array.isArray(value[key]) && value[key].every(v=>keys.includes(v)) && new Set(value[key]).size===value[key].length,`${prefix}: invalid ${key}.`);
}
