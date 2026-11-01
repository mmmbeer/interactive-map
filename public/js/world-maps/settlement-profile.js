import { settlementTypes, resourceKeys, environmentKeys } from '../generation/economy-settlements.js';
import { ancestries, settlementProfiles } from '../generation/settlement-pools-v1.js';
import { types } from '../generation/catalog-v2.js';
export const buildingFeatures={tavern:['tavern','tavern','Inn or tavern'],market:['guild','market','Market and quest board'],temple:['temple','temple','Temple'],guild:['guild','adventurers_guild','Adventurers’ guild'],smith:['workshop','blacksmith','Smithy'],harbor:['harbor','harbor','Harbor or ferry landing']};
export const landFeatures={farmland:'Crop fields',pasture:'Pasture',orchard:'Orchard',graveyard:'Burial ground'};
export const industryKeys='agriculture food textiles leather wood metal stone glass maritime transport records learning arcane medicine hospitality arts commerce civic'.split(' ');
export const ageProfiles={mixed:{adult:6,young_adult:2,elder:2},families:{adult:7,young_adult:2,elder:1},working:{adult:5,young_adult:4,elder:1},older:{adult:3,young_adult:1,elder:6}};
export const recommendations=type=>({
  features:type==='port'?['tavern','market','harbor','guild']:type==='fortress'?['smith','tavern','temple']:type==='monastery'?['temple','tavern']:['tavern','market','temple',...(['city','metropolis','academy','town'].includes(type)?['guild']:[])],
  landFeatures:type==='farming_village'?['farmland','pasture','orchard']:['hamlet','village'].includes(type)?['farmland','pasture']:[]
});
export function normalizeProfile(input={}) {
  const p={type:'town',ancestry:'human',secondary:'',secondaryPercent:25,wealth:'mixed',ages:'mixed',householdSize:null,districtMode:'suggested',districtCount:0,features:[],landFeatures:[],environment:[],resources:[],industries:[],...input};
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  check(Object.hasOwn(settlementTypes,p.type),'Choose the settlement type this area should represent.');
  check(Object.hasOwn(ancestries,p.ancestry),'Choose a supported primary ancestry.');
  check(!p.secondary||Object.hasOwn(ancestries,p.secondary)&&p.secondary!==p.ancestry,'Choose a different secondary ancestry.');
  check(Number.isInteger(p.secondaryPercent)&&p.secondaryPercent>=1&&p.secondaryPercent<=49,'Secondary ancestry must be 1 to 49 percent.');
  check(['mixed','modest','comfortable','wealthy'].includes(p.wealth),'Choose a living standard.');
  check(Object.hasOwn(ageProfiles,p.ages),'Choose a resident age mix.');
  check(p.householdSize===null||Number.isInteger(p.householdSize)&&p.householdSize>=1&&p.householdSize<=12,'Typical residents per home must be 1 to 12, or blank for varied households.');
  check(['suggested','mapped','single'].includes(p.districtMode),'Choose a district plan.');
  check(Number.isInteger(p.districtCount)&&p.districtCount>=0&&p.districtCount<=12,'Choose up to 12 districts.');
  for(const [key,allowed] of Object.entries({features:Object.keys(buildingFeatures),landFeatures:Object.keys(landFeatures),environment:environmentKeys,resources:resourceKeys,industries:industryKeys})) {
    check(Array.isArray(p[key])&&p[key].every(k=>allowed.includes(k)),`Choose supported ${key}.`);p[key]=[...new Set(p[key])].sort();
  }
  return p;
}
export function applyProfile(map,input) {
  const p=normalizeProfile(input),races=p.secondary?{[p.ancestry]:100-p.secondaryPercent,[p.secondary]:p.secondaryPercent}:null;
  const demographics={...(races?{races}:{race:p.ancestry}),ages:ageProfiles[p.ages],...(p.wealth==='mixed'?{wealths:{modest:6,comfortable:3,wealthy:1}}:{wealth:p.wealth})};
  const profile=settlementProfiles[p.ancestry];
  if(profile)map.generator.catalog={...map.generator.catalog,tables:{...map.generator.catalog?.tables,root:profile.roots,streetRoot:profile.streetRoots,waterRoot:profile.waterRoots,epithet:profile.surnames}};
  const settlement={type:p.type,environment:p.environment,...(p.resources.length?{resources:p.resources}:{}),...(p.industries.length?{industries:p.industries}:{})};
  map.generator.defaults={demographics,settlement};
  // Respect mixed demographics when the viewer first opens this saved import.
  map.settlementSettings={ancestry:'original',seed:String(map.generator.seed)};
  map.worldImport.settlement={version:1,...p};
  return p;
}
export function terrainCatalog(map,type,label=landFeatures[type]||type) {
  map.generator.catalog ||= {};map.generator.catalog.types ||= {};
  if(!map.generator.catalog.types[type])map.generator.catalog.types[type]={...types.field,label,tables:{...types.field.tables}};
}
