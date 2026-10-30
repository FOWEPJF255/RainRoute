'use strict';

const { createQlooClient, BASE_URL } = require('../src/qloo-client.cjs');
const { loadQlooApiKey } = require('../src/local-key.cjs');

function entities(payload) {
  const candidates = [payload?.results?.entities, payload?.results, payload?.entities];
  return candidates.find(Array.isArray) || [];
}

function selectSeedId(payload) {
  for (const item of entities(payload)) {
    const id = item?.entity_id ?? item?.id;
    if (typeof id === 'string' && /^[\w:.-]{3,120}$/.test(id)) return id;
  }
  return null;
}

async function main() {
  const key = loadQlooApiKey();
  if (!key) throw new Error('QLOO_KEY_MISSING: set QLOO_API_KEY or add it to the ignored .env file');
  const query = process.argv.slice(2).join(' ').trim() || 'The Grand Budapest Hotel';
  const client = createQlooClient({ apiKey: key });
  const searchPayload = await client.search(query);
  const searchResults = entities(searchPayload);
  const seedId = selectSeedId(searchPayload);
  if (!seedId) throw new Error('QLOO_SEED_NOT_FOUND: search returned no usable entity ID');
  const insightResults = entities(await client.placeInsights(seedId, 5));
  process.stdout.write(JSON.stringify({
    status: 'ok',
    checkedAt: new Date().toISOString(),
    host: BASE_URL,
    searchCandidateCount: searchResults.length,
    placeInsightCount: insightResults.length,
    routeFactsVerified: false
  }) + '\n');
}

if (require.main === module) {
  main().catch(error => {
    process.stderr.write(JSON.stringify({ status: 'failed', code: error.code ||
      String(error.message).split(':')[0], message: error.code ? error.message :
        'Qloo preflight could not complete; see code and local configuration.' }) + '\n');
    process.exitCode = 1;
  });
}

module.exports = { entities, selectSeedId };
