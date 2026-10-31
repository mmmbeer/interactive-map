import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readSettings } from '../public/js/generation/settlement-settings.js';
import { matches, searchPlaces } from '../public/js/spatial.js';
import { numberSites, siteNumbers } from '../public/js/site-index.js';
import { saveLocation, serializeMap } from '../public/js/authoring/model.js';
import { variationModel, saveVariation } from '../public/js/local-maps/variations.js';
import { resolveLocation } from '../public/js/generation/locations.js';
import { stockItems, expandedStockSources } from '../public/js/generation/stock-items-v2.js';
import { stockSources } from '../public/js/generation/trade-details-v1.js';
import { detailSourcesFor } from '../public/js/generation/detail-catalog.js';
import { validateMap } from '../public/js/map-contract.js';
const load=async()=>JSON.parse(await readFile(new URL('../public/data/maps/grayhaven.json',import.meta.url)));
test('search finds words found only in rumors and still combines category and district filters',async()=>{
  const place={id:'inn',name:'The Anchor',rumor:'A moonstonecipher is hidden upstairs.',category:'tavern',district:'Quay'};
  assert.ok(matches(place,{query:'MOONSTONECIPHER'}));
  assert.deepEqual(await searchPlaces([place],{query:'moonstonecipher',category:'tavern',district:'Quay'}),[place]);
  assert.equal(matches(place,{query:'moonstonecipher',district:'Hill'}),false);
});
test('site identities survive additions, deletions, imports and compact JSON reloads without reusing deleted numbers',()=>{
  const base=numberSites({id:'demo',locations:[{id:'b'},{id:'z'}]});
  const inserted=saveLocation(base,{id:'a'});assert.equal(siteNumbers(inserted.locations).get('b'),1);assert.equal(siteNumbers(inserted.locations).get('a'),3);
  const deleted={...inserted,locations:inserted.locations.filter(p=>p.id!=='a')};
  const next=saveLocation(JSON.parse(serializeMap(deleted)),{id:'aa'});assert.equal(siteNumbers(next.locations).get('aa'),4);
  const imported=numberSites({id:'demo',locations:[{id:'z'},{id:'new'}]},next);
  assert.equal(siteNumbers(imported.locations).get('z'),2);assert.equal(siteNumbers(imported.locations).get('new'),5);
  assert.equal(imported.nextSiteNumber,6);
});
test('published map numbers are explicitly saved and preserve the historical ID order',async()=>{
  for(const id of ['grayhaven','dragonsgate']) {
    const map=JSON.parse(await readFile(new URL(`../public/data/maps/${id}.json`,import.meta.url)));
    const old=siteNumbers(map.locations.map(p=>({id:p.id})));
    assert.deepEqual(siteNumbers(map.locations),old);assert.equal(map.nextSiteNumber,map.locations.length+1);
  }
});
test('local variations preserve generation identities, overrides and geometry while leaving originals untouched',async()=>{
  const base=await load(),before=JSON.stringify(base),edited=structuredClone(base);
  edited.locations[0].overrides={...edited.locations[0].overrides,rumor:'Local secret'};
  const copy=variationModel(edited,base,'local-test');validateMap(copy);
  assert.equal(copy.generationId,base.id);assert.equal(copy.id,'local-test');assert.equal(copy.localVariation.sourceId,base.id);
  assert.equal(JSON.stringify(base),before);
  const sample=base.locations.find(p=>p.category==='shop');
  assert.deepEqual(resolveLocation(copy,copy.locations.find(p=>p.id===sample.id)),resolveLocation(base,sample));
  const recopy=variationModel(copy,copy,'local-next');assert.equal(recopy.generationId,base.id);
});
test('saving a variation fetches assets and creates a separate local record with an original reset snapshot',async()=>{
  const base=await load(),edited=structuredClone(base);edited.locations[0].overrides={rumor:'Local only'};
  const fetched=[],saved=[];
  const record=await saveVariation(edited,base,null,{
    fetchAsset:async path=>{fetched.push(path);return {ok:true,blob:async()=>new Blob(['image'])};},
    save:async(...args)=>{saved.push(args);return {map:args[0],initialMap:args[3]};}
  });
  assert.deepEqual(fetched,[base.image,base.thumbnail]);assert.equal(saved.length,1);assert.deepEqual(saved[0][4],{create:true});
  assert.notEqual(record.map.id,base.id);assert.equal(record.map.id,record.initialMap.id);
  assert.equal(record.map.locations[0].overrides.rumor,'Local only');assert.notEqual(record.initialMap.locations[0].overrides?.rumor,'Local only');
  assert.equal(base.locations[0].overrides?.rumor,undefined);
});
test('stock catalogs provide 100 substantive product variants for every trade and retain released catalog support',()=>{
  assert.deepEqual(Object.keys(stockItems).sort(),Object.keys(stockSources).sort());
  for(const [trade,items] of Object.entries(stockItems)) {
    assert.equal(new Set(items).size,100,trade);
    assert.equal(new Set(expandedStockSources[`stock_${trade}`].map(v=>v.split('.')[0])).size,100,trade);
    assert.ok(!items.some(v=>/collected from|reserved by|receipt is|entered in a ledger|written orders/i.test(v)),trade);
  }
  assert.equal(detailSourcesFor({generator:{detailsVersion:1}}).stock_blacksmith,stockSources.blacksmith);
  assert.equal(detailSourcesFor({generator:{detailsVersion:2}}).stock_blacksmith,expandedStockSources.stock_blacksmith);
});
test('map validation rejects duplicate numbers and invalid scale calibration',async()=>{
  const map=await load();map.locations[0].siteNumber=map.locations[1].siteNumber;assert.throws(()=>validateMap(map),/site number/);
  for(const measurement of [{metersPerPixel:0,unit:'m'},{metersPerPixel:1,unit:'yards'}]) {
    const map=await load();map.measurement=measurement;assert.throws(()=>validateMap(map),/Scale|unit/);
  }
});

test('settlement settings survive localStorage failures through the saved local variation',async()=>{
  const map=await load();map.settlementSettings={ancestry:'elf',seed:'local-elf'};
  const broken={getItem(){throw new Error('Storage disabled');}};
  assert.deepEqual(readSettings(map,'https://example.com/',broken),map.settlementSettings);
});
