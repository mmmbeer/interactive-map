import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contains, ringContains } from '../public/js/geometry.js';

const map = JSON.parse(readFileSync(new URL('../public/data/maps/grayhaven.json', import.meta.url)));
const districtAt = (x, y) => map.districts.find(d => d.boundaries.some(b => ringContains(b.points, x, y)));
const distanceToSegment = ([x, y], [ax, ay], [bx, by]) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
};

test('Grayhaven districts follow the coast and contain their assigned locations', () => {
  assert.deepEqual([map.width,map.height],[3548,1774]);
  assert.equal(map.districts.length,12);
  assert.ok(map.locations.some(p => p.id === 'north-bay'));
  assert.equal(districtAt(3200, 1500), undefined, 'open water is outside every district');
  for (const place of map.locations) {
    const d = map.districts.find(d => d.id === place.district);
    if (place.category !== 'water') {
      assert.ok(d.boundaries.some(b => ringContains(b.points, place.x, place.y)), place.id);
    }
  }
  assert.ok(map.districts.every(d => d.boundaries[0].points.length > 8));
});

test('Grayhaven road overlays cross surveyed points on the roads', () => {
  for (const [id, points] of [
    ['east-west-way', [[85, 259], [370, 365], [800, 390]]],
    ['south-crossing', [[170, 623], [650, 631], [940, 696]]],
    ['central-avenue', [[676, 193], [652, 480], [668, 790]]],
    ['crown-road', [[983, 279], [1086, 180], [1187, 79]]]
  ]) {
    const route = map.locations.find(p => p.id === id).shape.points;
    for (const point of points) {
      const scaled = point.map(v => v*2);
      const distance = Math.min(...route.slice(1).map((b, i) => distanceToSegment(scaled, route[i], b)));
      assert.ok(distance < 4, `${id} misses ${point}: ${distance}`);
    }
  }
});

test('Grayhaven field entries select distinct visible parcels', () => {
  const field = id => map.locations.find(p => p.id === id).shape.points;
  for (const [left, right, a, b] of [
    ['commons-fields', 'west-croft', [50, 350], [200, 375]],
    ['garden-fields', 'garden-croft', [400, 130], [400, 190]],
    ['crossroads-fields', 'east-croft', [800, 445], [820, 530]]
  ]) {
    assert.ok(ringContains(field(left), ...a.map(v => v*2)), left);
    assert.ok(!ringContains(field(right), ...a.map(v => v*2)), right);
    assert.ok(ringContains(field(right), ...b.map(v => v*2)), right);
    assert.ok(!ringContains(field(left), ...b.map(v => v*2)), left);
  }
});


test('Grayhaven includes the full survey and opens its complete directory', async () => {
  const { viewerHTML } = await import('../public/js/places.js');
  const { materializeMap } = await import('../public/js/generation/locations.js');
  assert.equal(map.directoryScope,'all');
  assert.match(viewerHTML(materializeMap(map)),/data-scope="all" class="active" aria-pressed="true"/);
  assert.ok(map.locations.filter(p=>p.category==='street').length>=150);
  assert.ok(map.locations.filter(p=>p.category==='terrain').length>=80);
  assert.ok(map.locations.some(p=>p.id==='harbor-basin'));
  assert.ok(map.locations.some(p=>p.id==='harbor-breakwater'));
  const indexed=new Map(map.locations.map(p=>[p.id,p]));
  for(const p of map.locations.filter(p=>p.id.startsWith('roof-') || p.id.startsWith('building-'))) {
    assert.equal(indexed.get(p.context.street)?.category,'street',p.id);
    assert.ok(contains(p,p.x,p.y),`${p.id}: anchor is inside the footprint`);
  }
});

test('Grayhaven survey evidence matches the image and authored inputs', async () => {
  const { createHash }=await import('node:crypto');
  const audit=JSON.parse(readFileSync(new URL('../sources/grayhaven/audit.json',import.meta.url)));
  const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  assert.equal(audit.imageSha256,hash(readFileSync(new URL('../public/'+map.image,import.meta.url))));
  assert.equal(audit.surveySha256,hash(readFileSync(new URL('../sources/grayhaven/survey.json',import.meta.url))));
  assert.equal(audit.total,map.locations.length);
  assert.equal(audit.mapSha256,hash(readFileSync(new URL('../public/data/maps/grayhaven.json',import.meta.url))));
  assert.ok(audit.verification.districtsDisjoint);
  assert.ok(audit.verification.parcelsDisjoint);
  assert.ok(audit.verification.roadBrightPixelFraction>.94);
});


test('Grayhaven excludes the verified tree crowns from its building inventory', () => {
  const roofs=map.locations.filter(p=>p.id.startsWith('roof-') || p.id.startsWith('building-'));
  for(const [x,y] of [[313.5,97],[331,96.5],[352.5,99],[370.5,99]]) {
    assert.ok(!roofs.some(p=>contains(p,x*2,y*2)),`tree crown at ${x},${y}`);
  }
});
