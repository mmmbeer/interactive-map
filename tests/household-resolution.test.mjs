import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveLocation} from '../public/js/generation/locations.js';
import {socialGraph} from '../public/js/generation/social/index.js';
import {householdTypes} from '../public/js/generation/social/household-types.js';
import {adult} from '../public/js/generation/social/helpers.js';
import {applySettings} from '../public/js/generation/settlement-settings.js';
import {ancestries} from '../public/js/generation/settlement-pools-v1.js';
import {serializeMap} from '../public/js/authoring/model.js';
import {validateMap} from '../public/js/map-contract.js';

function source({style='shared_lodging',population=7,seed='seven-residents',polished=true}={}) {
  return {schemaVersion:2,id:'household-resolution',name:'Test',subtitle:'Test',description:'Test',theme:'Fantasy',region:'Coast',image:'map.webp',thumbnail:'thumb.webp',width:100,height:100,
    generator:{version:2,socialVersion:1,...(polished?{proseVersion:1}:{}),seed,
      defaults:{demographics:{race:'human',age:'adult',gender:'female',wealth:'comfortable'},settlement:{type:'town'}}},
    districts:[{id:'ward',name:'Ward'}],locations:[{id:'home',type:'home',category:'home',district:'ward',x:10,y:10,
      generation:{demographics:{population},social:{householdStyle:style}}}]};
}
const home=m=>resolveLocation(m,m.locations.find(p=>p.id==='home'));
const identity=p=>({id:p.id,name:p.name,race:p.race,culture:p.culture,gender:p.gender,homeId:p.homeId});

test('seven housemates retain their identities while extra residents resolve varied ages and occupations',()=>{
  for(let seed=0;seed<20;seed++) {
    const old=source({seed:String(seed),polished:false}),next=structuredClone(old);next.generator.proseVersion=1;
    const before=home(old),after=home(next),residents=after.community.residents;
    assert.equal(residents.length,7);assert.equal(after.community.household.count,7);
    assert.deepEqual(residents.map(identity),before.community.residents.map(identity));
    assert.equal(residents[0].age,before.community.residents[0].age);
    assert.ok(new Set(residents.slice(1).map(r=>r.age)).size>1);
    assert.ok(residents.every(r=>adult(r.age) && r.role==='housemate' && r.race==='human'));
    for(const r of residents)assert.ok(after.extra.household.text.includes(`; ${r.occupation}`),r.name);
    assert.ok(new Set(residents.map(r=>r.occupation)).size>1);
  }
});
test('every household structure retains required roles across all eleven ancestry patterns',()=>{
  for(const ancestry of Object.keys(ancestries))for(const [style,type] of Object.entries(householdTypes)) {
    const count=type.max || 8,m=applySettings(source({style,population:count}),{ancestry,seed:'member-plans'});
    validateMap(m);const p=home(m),g=socialGraph(m),residents=p.community.residents;
    assert.equal(residents.length,count);assert.ok(residents.every(r=>r.race===ancestry));
    for(const r of residents) {
      const raw=g.people.get(r.id),copy=structuredClone(raw);
      assert.equal(raw.demographics.age,raw.identity.demographics.age);assert.equal(copy.id,r.id);assert.equal(copy.identity.fullName,r.name);
    }
    if(['shared_lodging','siblings','companions','craft_household','partners'].includes(style))assert.ok(residents.every(r=>adult(r.age)));
    if(style==='guardian_dependents')assert.ok(residents.slice(1).every(r=>!adult(r.age) && r.role==='dependent'));
    if(style==='multigenerational') {assert.equal(residents[1].role,'older relative');assert.ok(residents.slice(2).every(r=>!adult(r.age)));}
    if(style==='care_household') {
      assert.equal(residents[1].role,'relative receiving support');assert.equal(residents[1].workplaceId,null);
      assert.equal(residents[1].occupation,'resident receiving support');
      assert.ok(residents.slice(2).every(r=>r.role==='caregiver' && adult(r.age)));
    }
  }
});
test('dependent and care recipients stay out of adult workplaces when extra slots are filled',()=>{
  for(const style of ['guardian_dependents','multigenerational','care_household']) {
    const m=source({style,population:10});
    m.locations.push(...Array.from({length:12},(_,i)=>({id:`work-${i}`,type:'cooper',category:'workshop',district:'ward',x:40,y:40})));
    const p=home(m);
    for(const r of p.community.residents)if(!adult(r.age) || r.role==='relative receiving support')assert.equal(r.workplaceId,null,r.name);
  }
});
test('a dependent primary resident retains a guardian and adult relatives',()=>{
  const m=source({style:'guardian_dependents',population:8});m.locations[0].generation.demographics.age='child';
  validateMap(m);const residents=home(m).community.residents;
  assert.equal(residents[0].age,'child');assert.equal(residents[0].role,'dependent');assert.equal(residents[0].workplaceId,null);
  assert.equal(residents[1].role,'guardian');assert.equal(residents[1].age,'adult');
  assert.ok(residents.slice(2).every(r=>adult(r.age) && r.role==='relative'));
});
test('valid explicit workplace age constraints retain their previously compatible adult slot',()=>{
  let checked=false;
  for(let seed=0;seed<40 && !checked;seed++) {
    const m=source({seed:String(seed)}),before=home(m).community.residents;
    for(const gender of ['female','male','nonbinary']) {
      const candidate=before.slice(1).find(r=>r.gender===gender);
      if(!candidate || candidate.age==='young_adult')continue;
      const pinned=structuredClone(m);
      pinned.locations.push({id:'pinned-work',type:'cooper',category:'workshop',district:'ward',x:40,y:40,
        generation:{demographics:{gender,age:'young_adult'},social:{home:'home'}}});
      const old=structuredClone(pinned);delete old.generator.proseVersion;validateMap(old);
      const oldKeeper=resolveLocation(old,old.locations[1]).community.residents[0];
      validateMap(pinned);
      const keeper=resolveLocation(pinned,pinned.locations[1]).community.residents[0],resident=home(pinned).community.residents.find(r=>r.id===keeper.id);
      assert.equal(keeper.id,oldKeeper.id);assert.equal(keeper.name,oldKeeper.name);
      assert.equal(keeper.age,'young_adult');assert.equal(resident.age,keeper.age);assert.equal(resident.name,keeper.name);
      assert.equal(home(pinned).community.residents[0].age,'adult');checked=true;break;
    }
  }
  assert.ok(checked,'The fixture must exercise a constrained secondary adult.');
});
test('member resolution is stable across view order, field selection, geometry and compact reloads',()=>{
  const m=source(),first=home(m),before=serializeMap(m),changed=JSON.parse(before);
  changed.locations[0].x=75;changed.locations[0].generation.fields=['name','household'];
  const after=home(changed);
  assert.deepEqual(after.community,first.community);assert.equal(after.extra.household.text,first.extra.household.text);
  assert.equal(serializeMap(m),before);assert.equal(JSON.parse(before).locations[0].community,undefined);
  const larger=structuredClone(m);larger.locations[0].generation.demographics.population=9;
  assert.deepEqual(home(larger).community.residents.slice(0,7),first.community.residents);
  const large=source({population:40});assert.equal(home(large).community.residents.length,12);assert.match(home(large).extra.household.text,/28 additional residents/);
});
test('planning stages stays independent of name pools and preserves literal household overrides',()=>{
  const m=source();let reads=0;
  const pool=new Proxy({female:['Ada'],male:['Ben'],nonbinary:['Ren'],surnames:['Oak']},{get(target,key){reads++;return target[key];}});
  m.generator.catalog={people:{human:pool}};
  socialGraph(m);assert.equal(reads,0);
  m.locations[0].overrides={household:'Authored household account.'};
  assert.equal(home(m).extra.household.text,'Authored household account.');assert.ok(reads>0);
});
