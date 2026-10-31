import { test } from 'node:test';
import assert from 'node:assert/strict';
import { socialSources, recipeTokens, scenarios } from '../public/js/generation/social/sources.js';
import { render } from '../public/js/generation/random.js';
import { materializeMap, resolveLocation } from '../public/js/generation/locations.js';
import { applySettings } from '../public/js/generation/settlement-settings.js';
import { ancestries } from '../public/js/generation/settlement-pools-v1.js';
import { availableFields } from '../public/js/generation/config.js';
import { resourceKeys } from '../public/js/generation/economy-settlements.js';

const boilerplate=/the request rests on|this town setting|two mapped locations|same unresolved matter|account has not been marked|original account|recorded trade:|current work concerns|the order belongs to|without substituting/i;
const brokenGrammar=/\b(?:the|a|an) (?:the|a|an)\b|’s (?:the|a|an)\b|damaged the|\bundefined\b|[{}]|\.\./i;
const place=(id,type,category=type)=>({id,type,category,district:'north',x:20,y:30});
const map=()=>({schemaVersion:2,id:'prose',name:'Grayhaven',region:'Region',
  generator:{version:2,socialVersion:1,seed:'world',defaults:{settlement:{type:'town'},demographics:{race:'human',age:'adult',gender:'male',wealth:'comfortable'}}},
  districts:[{id:'north',name:'North Crofts'}],locations:[
    {...place('home-a','home'),generation:{demographics:{population:2},social:{workplace:'mason'}}},
    {...place('home-b','home'),generation:{demographics:{population:2},social:{workplace:'inn'}}},
    {...place('mason','stonemason','workshop'),overrides:{name:'Pine Stonemason'}},place('inn','tavern')
  ]});
test('every story presentation states the event directly with compatible noun phrases',()=>{
  for(const product of ['inspection plate drain cover','granite lintels','a family recipe book','a set of measuring weights']) {
    const tokens={...Object.fromEntries(recipeTokens.map(k=>[k,`example-${k}`])),supplier:'Ivan Dawnward',buyer:'Rhea Copperward',fromPlace:'Pine Stonemason',toPlace:'Old Hearth',product,
      productName:product.replace(/^(?:a|an|the) /i,''),item:/^(?:a|an|the) /i.test(product)?product:`the ${product}`,amount:'18'};
    for(const scenario of Object.keys(scenarios))for(const entry of socialSources[`story_${scenario}`]) {
      const fact=render(entry,tokens);
      assert.doesNotMatch(fact,boilerplate);assert.doesNotMatch(fact,brokenGrammar);
      assert.ok(fact.includes('Ivan Dawnward') && fact.includes('Rhea Copperward'),scenario);
      assert.equal(fact.split(/(?<=[.!?])\s+/).length,2,scenario);
      if(scenario==='invoice')assert.ok(fact.includes('18 sp'));
      if(scenario==='collection')assert.match(fact,/unconfirmed|not.*confirm|no.*confirm|yet.*confirm|awaiting.*confirmation|still.*confirm|confirmation.*still/i);
      for(const goal of socialSources[`goal_${scenario}`])assert.doesNotMatch(render(goal,tokens),brokenGrammar);
    }
  }
});
test('shop sections have distinct purposes and keep one customer for the current commission',()=>{
  for(const ancestry of Object.keys(ancestries))for(let seed=0;seed<6;seed++) {
    const source=applySettings(map(),{ancestry,seed:String(seed)}),shop=source.locations.find(p=>p.id==='mason');
    source.generator.catalog={sections:{facts:{label:'Facts',templates:['{customer}|{product}|{material}|{supplyRoute}']}}};
    source.generator.defaults.fields=availableFields(source);
    const p=resolveLocation(source,shop),[customer,product]=p.extra.facts.text.split('|');
    assert.ok(p.extra.livelihood.text.includes(customer));assert.ok(p.extra.commissions.text.includes(customer));
    assert.ok(p.extra.commissions.text.includes(product));assert.ok(p.extra.stock.text.toLowerCase().includes(product));
    assert.doesNotMatch(p.extra.livelihood.text,/current task|current work|order/i);
    assert.doesNotMatch(p.extra.tradeLinks.text,/order book|current enquiry|current task/i);
    assert.doesNotMatch(p.extra.craftTradition.text,/Orders concern/);
    assert.doesNotMatch(p.extra.stock.text,/receipt|confirms|specification|ledger|estimate/i);
    const texts=['livelihood','tradeLinks','craftTradition','commissions'].map(k=>p.extra[k].text);
    const sentences=texts.flatMap(v=>v.split(/(?<=[.!?])\s+/));
    assert.equal(new Set(sentences).size,sentences.length);
    for(const text of [...texts,p.rumor,p.extra.residents.text,p.extra.connections.text,p.extra.requests.text]) {
      assert.doesNotMatch(text,boilerplate);assert.doesNotMatch(text,brokenGrammar);
    }
    const clone=structuredClone(source);clone.locations.reverse();
    const again=resolveLocation(clone,clone.locations.find(p=>p.id==='mason'));
    for(const key of ['rumor','extra','community'])assert.deepEqual(again[key],p[key]);
  }
});
test('local sourcing and outside sourcing retain the same material and mapped route',()=>{
  for(const local of [true,false]) {
    const source=map();delete source.generator.socialVersion;
    source.generator.defaults.settlement.resources=local?resourceKeys:[];
    source.locations=[{...place('grocer','grocer','shop'),context:{street:'road'}},{...place('road','road','street'),overrides:{name:'North Crossing'}}];
    source.generator.catalog={sections:{facts:{label:'Facts',templates:['{material}']}}};source.generator.defaults.fields=availableFields(source);
    const p=resolveLocation(source,source.locations[0]),text=p.extra.tradeLinks.text;
    assert.ok(text.includes(p.extra.facts.text));assert.ok(text.includes('North Crossing'));
    assert.equal(text.includes('Supplies are sourced locally'),local);
    assert.equal(text.includes('Supplies come from outside the settlement'),!local);
  }
});
test('authored text, templates and shared identities survive the prose rewrite',()=>{
  const source=map();
  source.locations[2].overrides={name:'Pine Stonemason',rumor:'An authored lead.',commissions:'A special commission.'};
  source.locations[2].generation={tables:{detail:['An authored detail.'],history:['An authored history.']}};
  const before=JSON.stringify(source),places=materializeMap(source).locations,p=places.find(p=>p.id==='mason'),home=places.find(p=>p.id==='home-a');
  assert.equal(p.rumor,'An authored lead.');assert.equal(p.extra.commissions.text,'A special commission.');
  assert.match(p.description,/An authored detail/);assert.match(p.description,/An authored history/);
  assert.equal(p.community.residents[0].id,home.community.residents[0].id);
  assert.equal(JSON.stringify(source),before);
});
