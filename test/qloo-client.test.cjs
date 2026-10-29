'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createQlooClient } = require('../src/qloo-client.cjs');

test('Qloo Insights 只发送必要参数和私有请求头', async () => {
  let captured;
  const fetchImpl = async (url, options) => {
    captured = { url, options };
    return { ok: true, json: async () => ({ results: { entities: [] } }) };
  };
  const client = createQlooClient({ apiKey: 'test-key', fetchImpl });
  await client.placeInsights('urn:entity:abc-123', 5);
  assert.equal(captured.url.origin, 'https://hackathon.api.qloo.com');
  assert.equal(captured.url.pathname, '/v2/insights');
  assert.equal(captured.url.searchParams.get('filter.type'), 'urn:entity:place');
  assert.equal(captured.url.searchParams.get('signal.interests.entities'), 'urn:entity:abc-123');
  assert.equal(captured.url.searchParams.get('take'), '5');
  assert.equal(captured.options.headers['X-Api-Key'], 'test-key');
  assert.ok(!captured.url.href.includes('test-key'));
});

test('搜索词作为 URL 参数编码，认证失败返回明确故障', async () => {
  let actualUrl;
  const client = createQlooClient({ apiKey: 'test-key', fetchImpl: async url => {
    actualUrl = url;
    return { ok: false, status: 401 };
  } });
  await assert.rejects(client.search('城市 记忆'), { code: 'QLOO_AUTH_ERROR' });
  assert.equal(actualUrl.pathname, '/search');
  assert.equal(actualUrl.searchParams.get('query'), '城市 记忆');
});

test('无 Key 时不进入假数据降级', () => {
  assert.throws(() => createQlooClient({ apiKey: '' }), { code: 'QLOO_KEY_MISSING' });
});
