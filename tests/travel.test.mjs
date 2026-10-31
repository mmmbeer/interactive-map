import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRoadGraph } from '../public/js/travel/graph.js';
import { roadRoute } from '../public/js/travel/routing.js';
import { pathLength, calibration, formatDistance, travelTime } from '../public/js/travel/geometry.js';
const road=(id,points)=>({id,category:'street',shape:{kind:'polyline',points}});
const point=(x,y)=>({x,y});
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-6,`${actual} != ${expected}`);
test('routes split crossings and T junctions without requiring shared source vertices',()=>{
  const graph=buildRoadGraph([road('horizontal',[[0,10],[100,10]]),road('vertical',[[50,0],[50,100]]),road('tee',[[20,10],[20,40]])],{joinTolerance:0});
  const result=roadRoute(graph,[point(0,10),point(50,90)]);
  near(result.length,130);assert.deepEqual(result.steps.map(s=>s.roadId),['horizontal','vertical']);
  near(roadRoute(graph,[point(20,40),point(100,10)]).length,110);
});
test('two stops on the same road segment take the direct subsegment in either direction',()=>{
  const graph=buildRoadGraph([road('one',[[0,0],[100,0]])]);
  near(roadRoute(graph,[point(20,0),point(70,0)]).length,50);
  near(roadRoute(graph,[point(70,0),point(20,0)]).length,50);
  near(roadRoute(graph,[point(20,0),point(20,0)]).length,0);
});
test('routing follows the shortest connected road path and includes intermediate access distances',()=>{
  const graph=buildRoadGraph([road('long',[[0,0],[0,100],[100,100],[100,0]]),road('short',[[0,0],[100,0]])],{joinTolerance:0});
  const route=roadRoute(graph,[point(10,5),point(50,10),point(90,5)]);
  near(route.length,110);near(route.accessLength,30);
  assert.ok(route.parts.some(p=>p.access));assert.ok(!route.steps.some(s=>s.roadId==='long'));
});
test('disconnected roads, absent roads and remote stops report errors without inventing paths',()=>{
  const graph=buildRoadGraph([road('a',[[0,0],[10,0]]),road('b',[[40,0],[50,0]])],{joinTolerance:0});
  assert.throws(()=>roadRoute(graph,[point(0,0),point(50,0)]),/No connected/);
  assert.throws(()=>roadRoute(graph,[point(0,100),point(50,0)],{maxSnapDistance:10}),/too far/);
  assert.throws(()=>roadRoute(buildRoadGraph([]),[point(0,0),point(5,0)]),/no mapped road/);
  assert.throws(()=>buildRoadGraph([],{joinTolerance:Infinity}),/tolerance/);
});
test('endpoint tolerance joins only bounded gaps and includes their actual distance',()=>{
  const roads=[road('a',[[0,0],[10,0]]),road('b',[[12,0],[30,0]])];
  assert.throws(()=>roadRoute(buildRoadGraph(roads,{joinTolerance:1}),[point(0,0),point(30,0)]),/No connected/);
  const result=roadRoute(buildRoadGraph(roads,{joinTolerance:2}),[point(0,0),point(30,0)]);
  near(result.length,30);near(result.gapLength,2);
});
test('collinear overlaps and closed road loops remain traversable',()=>{
  const graph=buildRoadGraph([road('a',[[0,0],[100,0]]),road('b',[[50,0],[150,0]]),road('loop',[[150,0],[150,50],[200,50],[200,0],[150,0]])],{joinTolerance:0});
  near(roadRoute(graph,[point(10,0),point(200,0)]).length,190);
});
test('calibration supports metric and imperial units without assuming an artwork scale',()=>{
  const points=[point(0,0),point(30,40)],scale=calibration(points,100,'ft');
  near(pathLength(points),50);near(scale.metersPerPixel,.6096);
  assert.equal(formatDistance(50,null),'50 px');assert.equal(formatDistance(50,scale),'100 ft');
  assert.equal(formatDistance(50,scale,'m'),'30.48 m');assert.equal(travelTime(1000,{metersPerPixel:1},4),'15 minutes');
  assert.throws(()=>calibration([point(0,0),point(0,0)],20,'m'),/distinct/);
  for(const [value,unit] of [[0,'m'],[Infinity,'m'],[10,'yards']])assert.throws(()=>calibration(points,value,unit));
});
