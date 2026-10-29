'use strict';

const { createQlooClient, BASE_URL } = require('../src/qloo-client.cjs');
const { loadQlooApiKey } = require('../src/local-key.cjs');

function entities(payload) {
  const candidates = [payload?.results?.entities, payload?.results, payload?.entities];
  return candidates.find(Array.isArray) || [];
}

async function main() {
  const key = loadQlooApiKey();
  if (!key) throw new Error('QLOO_KEY_MISSING: set QLOO_API_KEY or add it to the ignored .env file');
  const query = process.argv.slice(2).join(' ').trim() || 'The Grand Budapest Hotel';
  const client = createQlooClient({ apiKey: key });
  const searchResults = entities(await client.search(query));
  const seed = searchResults.find(item => typeof item?.id === 'string' && item.id.length >= 3);
  if (!seed) throw new Error('QLOO_SEED_NOT_FOUND: search returned no usable entity ID');
  const insightResults = entities(await client.placeInsights(seed.id, 5));
  process.stdout.write(JSON.stringify({
    status: 'ok',
    checkedAt: new Date().toISOString(),
    host: BASE_URL,
    searchCandidateCount: searchResults.length,
    placeInsightCount: insightResults.length,
    routeFactsVerified: false
  }) + '\n');
}

main().catch(error => {
  process.stderr.write(JSON.stringify({ status: 'failed', code: error.code ||
    String(error.message).split(':')[0], message: error.code ? error.message :
      'Qloo preflight could not complete; see code and local configuration.' }) + '\n');
  process.exitCode = 1;
});
