'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { selectSeedId } = require('../scripts/qloo-preflight.cjs');

test('preflight selects the entity_id returned by Qloo search', () => {
  assert.equal(selectSeedId({ results: [{ entity_id: '12345678-1234-1234-1234-123456789abc' }] }),
    '12345678-1234-1234-1234-123456789abc');
  assert.equal(selectSeedId({ results: [{ entity_id: 'invalid id' }] }), null);
});
