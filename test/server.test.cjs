'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server.cjs');

async function withServer(options, run) {
  const server = createServer(options);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { return await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('本地接口标记合成数据并阻止未核验真实路线', async () => {
  await withServer({}, async base => {
    const health = await (await fetch(`${base}/api/health`)).json();
    assert.equal(health.qlooConfigured, false);
    assert.equal(health.liveRouteReady, false);
    const demo = await fetch(`${base}/api/plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'demo', scenario: { rain: true } }) });
    assert.equal(demo.status, 200);
    const demoResult = await demo.json();
    assert.equal(demoResult.source, 'synthetic');
    assert.equal(demoResult.agentFramework, 'LangGraph');
    assert.deepEqual(demoResult.trace, [
      'resolve:synthetic-theme', 'discover:synthetic-catalogue', 'verify:synthetic-demo-only',
      'replan:hard-constraints', 'explain:source-bound'
    ]);
    const live = await fetch(`${base}/api/plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'live', scenario: {} }) });
    assert.equal(live.status, 503);
    assert.equal((await live.json()).error.code, 'QLOO_KEY_MISSING');
    const qloo = await fetch(`${base}/api/entity-search?q=city`);
    assert.equal(qloo.status, 503);
    assert.equal((await qloo.json()).error.code, 'QLOO_KEY_MISSING');
  });
});

test('模拟 Qloo 候选经过 Agent 状态图后，缺独立事实时停止规划', async () => {
  let calls = 0;
  await withServer({ apiKey: 'test-key', fetchImpl: async () => {
    calls++;
    return { ok: true, json: async () => ({ results: { entities: [{ name: 'public place' }] } }) };
  } }, async base => {
    const response = await fetch(`${base}/api/plan`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'live', entityId: 'urn:entity:abc-123', scenario: { rain: true } }) });
    assert.equal(response.status, 503);
    const result = await response.json();
    assert.equal(result.error.code, 'VENUE_FACTS_UNVERIFIED');
    assert.equal(result.source, 'qloo');
    assert.equal(result.agentFramework, 'LangGraph');
    assert.ok(result.trace.includes('discover:qloo-place-insights'));
    assert.ok(result.trace.includes('verify:venue-facts-missing'));
    assert.ok(!result.trace.includes('replan:hard-constraints'));
    assert.equal(calls, 1);
  });
});
