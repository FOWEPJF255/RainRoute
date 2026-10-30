'use strict';

const http = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { catalogue } = require('./src/catalogue.cjs');
const { createQlooClient } = require('./src/qloo-client.cjs');
const { runAgent } = require('./src/agent.cjs');
const { loadQlooApiKey } = require('./src/local-key.cjs');

function send(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(payload));
}

function fail(response, status, code, message) {
  send(response, status, { error: { code, message } });
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 16384) {
      const error = new Error('请求体超过 16 KB');
      error.code = 'BODY_TOO_LARGE';
      throw error;
    }
  }
  try { return JSON.parse(body); }
  catch { const error = new Error('请求体须为 JSON'); error.code = 'INVALID_JSON'; throw error; }
}

function createServer({ apiKey = '', fetchImpl = globalThis.fetch } = {}) {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    try {
      const publicFiles = {
        '/': ['index.html', 'text/html; charset=utf-8'],
        '/index.html': ['index.html', 'text/html; charset=utf-8'],
        '/style.css': ['style.css', 'text/css; charset=utf-8'],
        '/tokens.css': ['tokens.css', 'text/css; charset=utf-8'],
        '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
        '/sandbox/': ['index.html', 'text/html; charset=utf-8'],
        '/live.html': ['live.html', 'text/html; charset=utf-8'],
        '/live.css': ['live.css', 'text/css; charset=utf-8'],
        '/live.js': ['live.js', 'text/javascript; charset=utf-8']
      };
      if (request.method === 'GET' && publicFiles[url.pathname]) {
        const [file, contentType] = publicFiles[url.pathname];
        const body = await readFile(path.join(__dirname, 'public', file));
        response.writeHead(200, { 'Content-Type': contentType, 'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'no-store' });
        return response.end(body);
      }
      if (request.method === 'GET' && url.pathname === '/api/health')
        return send(response, 200, { status: 'ok', version: '0.1.0', qlooConfigured: Boolean(apiKey), liveRouteReady: false });
      if (request.method === 'GET' && url.pathname === '/api/demo/catalog')
        return send(response, 200, catalogue);
      if (request.method === 'POST' && url.pathname === '/api/discover') {
        const body = await readBody(request);
        const { discoverPlaces, DiscoveryError } = await import('./src/discovery.mjs');
        try { return send(response, 200, await discoverPlaces({ theme: body.theme, apiKey, fetchImpl })); }
        catch (error) {
          if (error instanceof DiscoveryError) return fail(response, error.status, error.code, error.message);
          throw error;
        }
      }
      if (request.method === 'POST' && url.pathname === '/api/plan') {
        const body = await readBody(request);
        if (body.mode !== 'demo' && body.mode !== 'live')
          return fail(response, 400, 'INVALID_MODE', 'mode 须为 demo 或 live');
        const result = await runAgent({ mode: body.mode, scenario: body.scenario || {}, entityId: body.entityId,
          qlooClient: body.mode === 'live' ? createQlooClient({ apiKey, fetchImpl }) : undefined });
        if (result.status === 'blocked') return send(response, 503, {
          error: { code: result.reason, message: result.explanation },
          source: result.source, trace: result.trace, agentFramework: result.agentFramework
        });
        return send(response, 200, result);
      }
      if (request.method === 'GET' && url.pathname === '/api/entity-search') {
        const data = await createQlooClient({ apiKey, fetchImpl }).search(url.searchParams.get('q') || '');
        return send(response, 200, { source: 'qloo', factStatus: 'unverified', data });
      }
      if (request.method === 'GET' && url.pathname === '/api/insights') {
        const data = await createQlooClient({ apiKey, fetchImpl }).placeInsights(
          url.searchParams.get('entityId') || '', Number(url.searchParams.get('take') || 10));
        return send(response, 200, { source: 'qloo', factStatus: 'unverified', data });
      }
      return fail(response, 404, 'NOT_FOUND', '接口不存在');
    } catch (error) {
      if (error.code === 'INVALID_SCENARIO' || error.code === 'INVALID_JSON')
        return fail(response, 400, error.code, error.message);
      if (error.code === 'BODY_TOO_LARGE') return fail(response, 413, error.code, error.message);
      if (error.name === 'QlooError') return fail(response, error.status, error.code, error.message);
      return fail(response, 500, 'INTERNAL_ERROR', '内部错误');
    }
  });
}

if (require.main === module) {
  const host = '127.0.0.1';
  const port = Number(process.env.PORT || 3000);
  createServer({ apiKey: loadQlooApiKey() }).listen(port, host, () => {
    process.stdout.write(`RainRoute API: http://${host}:${port}\n`);
  });
}

module.exports = { createServer };
