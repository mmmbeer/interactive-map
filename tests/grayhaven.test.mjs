import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ringContains } from '../public/js/geometry.js';

const map = JSON.parse(readFileSync(new URL('../public/data/maps/grayhaven.json', import.meta.url)));
const districtAt = (x, y) => map.districts.find(d => d.boundaries.some(b => ringContains(b.points, x, y)));
const distanceToSegment = ([x, y], [ax, ay], [bx, by]) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
};

test('Grayhaven districts follow the coast and contain their assigned locations', () => {
  assert.ok(map.locations.filter(p => p.category === 'home').length >= 900);
  assert.ok(map.locations.some(p => p.id === 'north-bay'));
  assert.equal(districtAt(1600, 750), undefined, 'open water is outside every district');
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
    ['east-west-way', [[85, 254], [370, 358], [800, 391]]],
    ['south-crossing', [[170, 625], [650, 632], [940, 686]]],
    ['central-avenue', [[681, 193], [653, 480], [663, 790]]],
    ['crown-road', [[985, 281], [1085, 179], [1185, 77]]]
  ]) {
    const route = map.locations.find(p => p.id === id).shape.points;
    for (const point of points) {
      const distance = Math.min(...route.slice(1).map((b, i) => distanceToSegment(point, route[i], b)));
      assert.ok(distance < 4, `${id} misses ${point}: ${distance}`);
    }
  }
});
