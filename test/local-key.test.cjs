'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadQlooApiKey } = require('../src/local-key.cjs');

test('本地 Key 仅从环境或被忽略的 .env 读取，环境变量优先', () => {
  const original = process.env.QLOO_API_KEY;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rainroute-key-test-'));
  const file = path.join(dir, '.env');
  try {
    delete process.env.QLOO_API_KEY;
    assert.equal(loadQlooApiKey(dir), '');
    fs.writeFileSync(file, '# local only\nQLOO_API_KEY="file-test-value"\n');
    assert.equal(loadQlooApiKey(dir), 'file-test-value');
    process.env.QLOO_API_KEY = 'env-test-value';
    assert.equal(loadQlooApiKey(dir), 'env-test-value');
  } finally {
    if (original === undefined) delete process.env.QLOO_API_KEY;
    else process.env.QLOO_API_KEY = original;
    if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.rmdirSync(dir);
  }
});
