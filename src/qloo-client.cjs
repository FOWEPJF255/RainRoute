'use strict';

const BASE_URL = 'https://hackathon.api.qloo.com';

class QlooError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.name = 'QlooError';
    this.code = code;
    this.status = status;
  }
}

function createQlooClient({ apiKey, fetchImpl = globalThis.fetch, timeoutMs = 8000 } = {}) {
  if (!apiKey) throw new QlooError('QLOO_KEY_MISSING', '未配置 Qloo API Key', 503);
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl 必须是函数');
  async function get(path, params) {
    const url = new URL(path, BASE_URL);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    let response;
    try {
      response = await fetchImpl(url, {
        headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (error) {
      throw new QlooError(error.name === 'TimeoutError' ? 'QLOO_TIMEOUT' : 'QLOO_NETWORK_ERROR',
        error.name === 'TimeoutError' ? 'Qloo 请求超时' : '无法连接 Qloo');
    }
    if (!response.ok) {
      const status = response.status;
      const code = status === 401 || status === 403 ? 'QLOO_AUTH_ERROR' :
        status === 429 ? 'QLOO_RATE_LIMIT' : 'QLOO_UPSTREAM_ERROR';
      throw new QlooError(code, `Qloo 返回 HTTP ${status}`, status === 429 ? 503 : 502);
    }
    try { return await response.json(); }
    catch { throw new QlooError('QLOO_INVALID_RESPONSE', 'Qloo 返回了非 JSON 响应'); }
  }
  return {
    search(query) {
      if (typeof query !== 'string' || query.trim().length < 2 || query.length > 120)
        throw new QlooError('INVALID_QUERY', '搜索词长度须为 2–120 个字符', 400);
      return get('/search', { query: query.trim() });
    },
    placeInsights(entityId, take = 10) {
      if (typeof entityId !== 'string' || !/^[\w:.-]{3,120}$/.test(entityId))
        throw new QlooError('INVALID_ENTITY_ID', 'Qloo entity ID 格式无效', 400);
      if (!Number.isInteger(take) || take < 1 || take > 25)
        throw new QlooError('INVALID_TAKE', 'take 须为 1–25 的整数', 400);
      return get('/v2/insights', {
        'filter.type': 'urn:entity:place',
        'signal.interests.entities': entityId,
        take: String(take)
      });
    }
  };
}

module.exports = { createQlooClient, QlooError, BASE_URL };
