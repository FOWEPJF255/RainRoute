'use strict';

const { createServer } = require('../server.cjs');
const { loadQlooApiKey } = require('../src/local-key.cjs');
const { selectSeedId } = require('./qloo-preflight.cjs');

async function main() {
  const apiKey = loadQlooApiKey();
  if (!apiKey) throw new Error('QLOO_KEY_MISSING');
  const server = createServer({ apiKey });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const search = await fetch(`${base}/api/entity-search?q=The%20Grand%20Budapest%20Hotel`);
    const searchPayload = await search.json();
    const entityId = selectSeedId(searchPayload.data);
    if (!search.ok || !entityId) throw new Error('SEARCH_FAILED');
    const response = await fetch(`${base}/api/plan`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'live', entityId })
    });
    const result = await response.json();
    const verified = response.status === 503 && result.error?.code === 'VENUE_FACTS_UNVERIFIED' &&
      result.agentFramework === 'LangGraph' && result.trace?.includes('discover:qloo-place-insights');
    if (!verified) throw new Error('LIVE_GUARD_FAILED');
    process.stdout.write(JSON.stringify({ status: 'ok', searchStatus: search.status,
      planStatus: response.status, reason: result.error.code, agentFramework: result.agentFramework }) + '\n');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  const known = new Set(['QLOO_KEY_MISSING', 'SEARCH_FAILED', 'LIVE_GUARD_FAILED']);
  process.stderr.write(JSON.stringify({ status: 'failed', code: known.has(error.message) ? error.message : 'CHECK_FAILED' }) + '\n');
  process.exitCode = 1;
});
