# Hosted Worker

The hosted app uses `src/discovery.mjs`, `src/quota.mjs`, and `src/hosted-worker.mjs`. The public page is `public/live.html`, `live.js`, and `live.css`. Build the static sandbox first, then generate the single Worker entrypoint:

```text
npm ci
npm test
npm run build:static
node scripts/build-hosted.cjs <absolute-worker-project-directory>
```

The generated `worker/index.js` exports a standard Cloudflare Worker `fetch` handler. Configure `QLOO_API_KEY` as a **server secret** and bind a D1 database as `DB`. Apply `schema.sql` through the host's migration system before publishing. The app refuses discovery when that database is unavailable. The supplied Node development server is localhost-only; it is not the quota-protected hosted entrypoint.

The Sites deployment is generated in a separate checkout using its Worker ESM starter and D1 migrations. Its `.openai/hosting.json` declares `d1: "DB"`, `r2: null`, and the Site-specific opaque project ID. Deployment credentials and the Qloo key do not belong in this public repository or generated assets.

Limits are defined in `src/quota.mjs`: 6 discovery attempts per browser/day, 30 per network/day, and 120 upstream Qloo HTTP requests per day across the service. The latter is reserved in pairs before a search-plus-insights workflow. Daily counters reset at 00:00 UTC. The live browser shows the corresponding local time. Cached results still consume a visitor attempt but do not consume an upstream request reservation.

Anonymous limits are abuse controls, not proof of a natural person's identity. No raw network address is stored in D1, and no visitor identifier is forwarded to Qloo.
