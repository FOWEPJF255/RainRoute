'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const seedName = 'The Grand Budapest Hotel';
function stubSearch(results) {
  const calls = [];
  return {
    calls,
    fetchImpl: async url => {
      calls.push(new URL(url));
      return { ok: true, json: async () => ({ results: calls.length === 1 ? results : [] }) };
    }
  };
}

for (const [label, results] of [
  ['an unrelated search hit', [{ entity_id: 'other-film', name: 'Another movie' }]],
  ['a search hit without a name', [{ entity_id: 'unnamed-film' }]],
  ['a named hit with a non-string ID', [{ entity_id: 123, name: seedName }]],
  ['a named hit with a whitespace ID', [{ entity_id: '   ', name: seedName }]]
]) {
  test(`discovery rejects ${label} without requesting place insights`, async () => {
    const { discoverPlaces } = await import('../src/discovery.mjs');
    const stub = stubSearch(results);
    await assert.rejects(
      discoverPlaces({ theme: 'cinema', apiKey: 'test-only-key', fetchImpl: stub.fetchImpl }),
      { code: 'SEED_NOT_FOUND', status: 404 }
    );
    assert.equal(stub.calls.length, 1);
    assert.equal(stub.calls[0].pathname, '/search');
  });
}

test('discovery finds a usable exact match after a matching hit without an ID', async () => {
  const { discoverPlaces } = await import('../src/discovery.mjs');
  const stub = stubSearch([
    { name: seedName },
    { name: seedName, entity_id: 'confirmed-film' }
  ]);
  const result = await discoverPlaces({ theme: 'cinema', apiKey: 'test-only-key', fetchImpl: stub.fetchImpl });
  assert.equal(stub.calls.length, 2);
  assert.equal(stub.calls[1].searchParams.get('signal.interests.entities'), 'confirmed-film');
  assert.equal(result.seed.label, seedName);
  assert.equal(result.routeReady, false);
});

test('discovery preserves case-insensitive exact matching ahead of unrelated hits', async () => {
  const { discoverPlaces } = await import('../src/discovery.mjs');
  const stub = stubSearch([
    { name: 'Another movie', entity_id: 'unrelated-film' },
    { name: seedName.toUpperCase(), entity_id: 'confirmed-film' }
  ]);
  const result = await discoverPlaces({ theme: 'cinema', apiKey: 'test-only-key', fetchImpl: stub.fetchImpl });
  assert.equal(stub.calls.length, 2);
  assert.equal(stub.calls[1].searchParams.get('signal.interests.entities'), 'confirmed-film');
  assert.equal(result.routeReady, false);
});
