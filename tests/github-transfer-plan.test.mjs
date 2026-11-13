import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planTransfer,MAX_REQUEST_BYTES} from '../.github/scripts/plan-github-transfer.mjs';
const defaults={repository:'mmmbeer/interactive-map',baseTree:'a'.repeat(40)};
test('existing blobs and duplicate build aliases never require another content upload',()=>{
  let reads=0;
  const plan=planTransfer({...defaults,availableShas:['existing'],
    changes:[{path:'archive.tar.gz',sha:'existing'},{path:'public/a.js',sha:'new'},{path:'dist/a.js',sha:'new'}],
    readBlob(){reads++;return Buffer.from('content');}});
  assert.equal(reads,1);assert.equal(plan.reusedBlobs,1);assert.equal(plan.uploads.length,1);
  assert.equal(plan.treeBatches[0].entries.length,3);assert.equal(plan.ready,true);
});
test('request limits account for JSON escaping, UTF-8 and binary base64 expansion',()=>{
  for(const data of [Buffer.from('"\\\n\t'.repeat(1000)),Buffer.from('🌳'.repeat(1100)),Buffer.alloc(4000,255)]) {
    const plan=planTransfer({...defaults,maxBytes:4096,changes:[{path:'large',sha:'new'}],readBlob:()=>data});
    assert.equal(plan.ready,false);assert.equal(plan.blocked.length,1);assert.equal(plan.uploads.length,0);
    assert.ok(plan.blocked[0].requestBytes>4096);
  }
  const binary=planTransfer({...defaults,changes:[{path:'binary',sha:'b'}],readBlob:()=>Buffer.from([255,254])});
  assert.equal(binary.uploads[0].encoding,'base64');
});
test('oversized archives fail closed while their existing remote objects remain reusable',()=>{
  const changes=[{path:'source.tar.gz',sha:'large'}];
  const plan=planTransfer({...defaults,changes,readBlob:()=>Buffer.alloc(MAX_REQUEST_BYTES,255)});
  assert.equal(plan.ready,false);assert.ok(plan.blocked[0].requestBytes>MAX_REQUEST_BYTES);
  const reused=planTransfer({...defaults,changes,availableShas:['large'],readBlob(){throw new Error('must not read');}});
  assert.equal(reused.ready,true);assert.equal(reused.uploads.length,0);
});
test('tree requests stay within both the byte budget and entry count',()=>{
  const changes=Array.from({length:350},(_,i)=>({path:`long-${i}/`+'x'.repeat(100),sha:'same'}));
  const plan=planTransfer({...defaults,maxBytes:4096,changes,availableShas:['same'],readBlob(){throw new Error('must not read');}});
  assert.ok(plan.treeBatches.length>4);
  assert.equal(plan.treeBatches.flatMap(batch=>batch.entries).length,350);
  assert.ok(plan.treeBatches.every(batch=>batch.entries.length<=100&&batch.requestBytes<=4096));
  const countLimited=planTransfer({...defaults,changes,availableShas:['same'],readBlob(){throw new Error('must not read');}});
  assert.deepEqual(countLimited.treeBatches.map(batch=>batch.entries.length),[100,100,100,50]);
});
test('deletions are explicit null SHA entries and budgets cannot exceed the project cap',()=>{
  const plan=planTransfer({...defaults,changes:[{path:'old.js',sha:null}],readBlob(){throw new Error('must not read');}});
  assert.equal(plan.treeBatches[0].entries[0].sha,null);assert.equal(plan.uploads.length,0);
  assert.throws(()=>planTransfer({...defaults,maxBytes:MAX_REQUEST_BYTES+1,changes:[]}),/budget/);
});
