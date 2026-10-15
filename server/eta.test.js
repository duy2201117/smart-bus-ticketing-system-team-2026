import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceKm, estimateEta } from './eta.js';

test('ETA uses GPS/simulation coordinates and route stops', () => {
  const km = distanceKm({ lat: 21.0285, lng: 105.8542 }, { lat: 21.5942, lng: 105.8482 });
  assert.ok(km > 50 && km < 80);
  const result = estimateEta({ lat: 21.1, lng: 105.85, locationSource: 'gps' }, [
    { id: 'a', name: 'A', stopOrder: 1, lat: 21.15, lng: 105.85 },
    { id: 'b', name: 'B', stopOrder: 2, lat: 21.55, lng: 105.85 },
  ]);
  assert.ok(result.etaMinutes > 0);
  assert.ok(result.distanceKmRemaining > 0);
  assert.equal(result.etaSource, 'gps-estimate');
  assert.equal(result.nextStop.name, 'A');
});
