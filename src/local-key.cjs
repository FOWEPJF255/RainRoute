'use strict';

const fs = require('node:fs');
const path = require('node:path');

// The optional local file is intentionally ignored by Git. Never log its value.
function loadQlooApiKey(root = path.join(__dirname, '..')) {
  if (process.env.QLOO_API_KEY) return process.env.QLOO_API_KEY.trim();
  const file = path.join(root, '.env');
  if (!fs.existsSync(file)) return '';
  const line = fs.readFileSync(file, 'utf8').split(/\r?\n/)
    .find(value => /^\s*QLOO_API_KEY\s*=/.test(value));
  if (!line) return '';
  const value = line.slice(line.indexOf('=') + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) return value.slice(1, -1);
  return value;
}

module.exports = { loadQlooApiKey };
