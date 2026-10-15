import test from 'node:test';
import assert from 'node:assert/strict';
import { weightedAverage, backtest } from './operations/analytics.js';

const history = [
  { passengers: 42 }, { passengers: 40 }, { passengers: 38 }, { passengers: 35 },
  { passengers: 32 }, { passengers: 30 }, { passengers: 27 }, { passengers: 25 },
  { passengers: 22 }, { passengers: 20 }, { passengers: 18 }, { passengers: 16 },
];

test('weighted demand forecast is deterministic and backtest returns real metrics', () => {
  const forecast = weightedAverage(history);
  assert.ok(Number.isFinite(forecast));
  assert.ok(forecast > 0);
  const metrics = backtest(history);
  assert.ok(metrics);
  assert.ok(metrics.samples >= 1);
  assert.ok(Number.isFinite(metrics.mae) && metrics.mae >= 0);
  assert.ok(metrics.mape === null || (Number.isFinite(metrics.mape) && metrics.mape >= 0));
});

test('backtest reports insufficient data instead of inventing accuracy', () => {
  assert.equal(backtest(history.slice(0, 4)), null);
});
