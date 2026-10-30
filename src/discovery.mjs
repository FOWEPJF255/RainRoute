export const SEEDS = Object.freeze({
  cinema: { query: 'The Grand Budapest Hotel', label: 'The Grand Budapest Hotel', kind: 'Cinema', note: 'Explore places through a cinematic cultural signal.' },
  jazz: { query: 'Miles Davis', label: 'Miles Davis', kind: 'Music', note: 'Explore places through a jazz cultural signal.' },
  books: { query: 'Agatha Christie', label: 'Agatha Christie', kind: 'Literature', note: 'Explore places through a literary cultural signal.' }
});
const BASE = 'https://hackathon.api.qloo.com';

export class DiscoveryError extends Error {
  constructor(code, message, status = 502) { super(message); this.code = code; this.status = status; }
}
function list(payload) {
  return [payload?.results?.entities, payload?.results, payload?.entities].find(Array.isArray) || [];
}
function safeUrl(value) {
  try { const u = new URL(value); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null; }
  catch { return null; }
}
function text(value, max = 240) { return typeof value === 'string' ? value.slice(0, max) : ''; }

export async function discoverPlaces({ theme, apiKey, fetchImpl = fetch }) {
  const seed = typeof theme === 'string' && Object.hasOwn(SEEDS, theme) ? SEEDS[theme] : null;
  if (!seed) throw new DiscoveryError('INVALID_THEME', 'Choose one of the three public cultural seeds.', 400);
  if (!apiKey) throw new DiscoveryError('QLOO_KEY_MISSING', 'Live discovery is not configured.', 503);
  async function get(path, params) {
    const url = new URL(path, BASE);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
    let response;
    try { response = await fetchImpl(url, { headers: { 'X-Api-Key': apiKey, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) }); }
    catch { throw new DiscoveryError('QLOO_UNREACHABLE', 'Qloo did not respond in time. Please retry shortly.', 503); }
    if (!response.ok) throw new DiscoveryError(response.status === 429 ? 'QLOO_RATE_LIMIT' : 'QLOO_REQUEST_FAILED', 'Live cultural discovery is temporarily unavailable.', 503);
    let payload;
    try { payload = await response.json(); } catch { throw new DiscoveryError('QLOO_INVALID_RESPONSE', 'Qloo returned an unreadable response.'); }
    if (payload?.success === false || payload?.error) throw new DiscoveryError('QLOO_REQUEST_FAILED', 'Live cultural discovery is temporarily unavailable.', 503);
    return payload;
  }
  const search = list(await get('/search', { query: seed.query }));
  const exact = search.find(e => e.name?.toLowerCase() === seed.query.toLowerCase());
  const selected = exact || search.find(e => typeof (e.entity_id ?? e.id) === 'string');
  const id = selected?.entity_id ?? selected?.id;
  if (!id) throw new DiscoveryError('SEED_NOT_FOUND', 'No usable cultural seed was found. Choose another theme.', 404);
  const raw = list(await get('/v2/insights', { 'filter.type': 'urn:entity:place', 'signal.interests.entities': id, take: 8 }));
  const candidates = raw.map((e, index) => ({
    id: text(e.entity_id ?? e.id, 120), name: text(e.name, 160), rank: index + 1,
    city: text(e.properties?.geocode?.city ?? e.properties?.locality?.city, 80),
    country: text(e.properties?.geocode?.country ?? e.properties?.locality?.country, 80),
    address: text(e.properties?.address), website: safeUrl(e.properties?.website),
    description: text(e.properties?.short_description ?? e.properties?.description, 380),
    affinity: typeof e.query?.affinity === 'number' ? e.query.affinity : null,
    tags: (Array.isArray(e.tags) ? e.tags : []).slice(0, 4).map(t => text(t.name, 64)).filter(Boolean),
    providerReportsClosed: e.properties?.is_closed === true,
    providerHoursAvailable: !!e.properties?.hours && typeof e.properties.hours === 'object',
    factStatus: 'independently-unverified'
  })).filter(e => e.id && e.name);
  return { source: 'qloo', checkedAt: new Date().toISOString(), seed: { label: text(selected?.name) || seed.label, kind: seed.kind },
    candidates, routeReady: false, trace: [
      { stage: 'Resolve', detail: `Resolve the public cultural seed: ${seed.label}.` },
      { stage: 'Discover', detail: `Qloo place insights returned ${candidates.length} cultural candidates.` },
      { stage: 'Verify', detail: 'Separate cultural affinity from independently verified operational facts.' },
      { stage: 'Decide', detail: 'Offer a reviewable shortlist; block a real itinerary while facts remain unknown.' }
    ] };
}
