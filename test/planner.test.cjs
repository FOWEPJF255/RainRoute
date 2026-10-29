'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { catalogue } = require('../src/catalogue.cjs');
const { plan } = require('../src/planner.cjs');

test('雨天会淘汰露天原路线，返回满足所有硬约束的替代路线', () => {
  const result = plan({ rain: true, budget: 100, end: 1080 }, catalogue);
  assert.equal(result.source, 'synthetic');
  assert.equal(result.original.checks.weather, false);
  assert.equal(result.status, 'ok');
  assert.ok(result.routes.length > 0);
  for (const route of result.routes) {
    assert.equal(route.feasible, true);
    assert.ok(Object.values(route.checks).every(Boolean));
    assert.ok(route.visits.every(v => v.checks.weather));
  }
});

test('组合事件下仍核对关闭、预算、结束时间与营业', () => {
  const result = plan({ rain: true, delay: 40, closed: 'B1', budget: 45, end: 1080 }, catalogue);
  assert.equal(result.examined, 27);
  assert.ok(result.routes.length > 0);
  for (const route of result.routes) {
    assert.ok(route.cost <= 45 && route.end <= 1080);
    assert.ok(!route.ids.includes('B1'));
    assert.ok(route.visits.every(v => v.checks.opening));
  }
});

test('无解时不制造看似可行的新路线', () => {
  const result = plan({ rain: true, budget: 0, end: 790 }, catalogue);
  assert.equal(result.status, 'no-solution');
  assert.deepEqual(result.routes, []);
  assert.equal(result.feasibleCount, 0);
  assert.equal(result.rejected, result.examined);
});

test('非法情境被拒绝而非静默放宽约束', () => {
  assert.throws(() => plan({ rain: 'yes' }, catalogue), { code: 'INVALID_SCENARIO' });
  assert.throws(() => plan({ closed: 'UNKNOWN' }, catalogue), { code: 'INVALID_SCENARIO' });
  assert.throws(() => plan({ budget: -1 }, catalogue), { code: 'INVALID_SCENARIO' });
});
