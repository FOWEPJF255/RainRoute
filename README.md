# RainRoute

RainRoute is a cultural discovery and feasibility-screening agent. Its live experience resolves a public cultural seed, requests real Qloo place insights, presents an inspectable candidate shortlist, and identifies the operational facts that still need verification. A separate planning sandbox demonstrates how hard constraints change a three-stop route during rain, delay, closure, budget, and finish-time disruptions.

**Status:** Live cultural discovery calls Qloo on the server. The planning sandbox uses synthetic venues and operational facts and does not call Qloo. Neither experience claims a verified real-world itinerary: Qloo affinity and provider metadata do not establish current opening status, actual cost, indoor access, walking time, or weather suitability.

## Try the demo

The [live English experience](https://rainroute-cultural-agent.lunarsnail20.chatgpt.site) discovers Qloo places from three public seeds: a film, a musician, and an author. Inspect each candidate's evidence, compare locations and cultural tags, add or remove candidates from a session shortlist, and review the verification checklist and agent trail. A closed-place filter uses Qloo's closure flag, explicitly labeled as provider metadata.

The [synthetic planning sandbox](https://fowepjf255.github.io/RainRoute/) includes rainy-day replanning, a 90-minute delay plus closure, no solution, and a simulated retrieval failure. Its interface is in Chinese; the [English walkthrough](DEMO_GUIDE_EN.md) translates its controls and testing steps. The source files in `docs/` are a self-contained GitHub Pages build. The hosted live experience also serves it at `/sandbox/`.

## Run locally

Requires Node.js **22.19.0 or newer** (including the official Qloo harness and the SQLite quota tests).

```bash
npm ci
npm test
npm start
```

Open `http://127.0.0.1:3000/live.html` for live discovery, or `/` for the synthetic sandbox. The server binds to localhost. API routes:

- `GET /api/health` returns the readiness flags.
- `GET /api/demo/catalog` returns the **synthetic** scenario catalogue.
- `POST /api/discover` with `{"theme":"cinema"}` (or `jazz`, `books`) runs real cultural discovery. It accepts only fixed public seeds.
- `POST /api/plan` with `{"mode":"demo","scenario":{"theme":0,"rain":true,"delay":0,"budget":100,"end":1020,"closed":null}}` runs the demo agent graph.
- `GET /api/entity-search?q=...` and `GET /api/insights?entityId=...` use Qloo when a private `QLOO_API_KEY` environment variable is configured.
- `POST /api/plan` with `mode=live` can discover Qloo place candidates, then returns `VENUE_FACTS_UNVERIFIED` until hours, prices, walking time, and weather have trustworthy independent sources. It never silently substitutes demo facts.

The Qloo key stays on the server. When an official key is issued, put `QLOO_API_KEY=...` in a local `.env` copied from `.env.example`, or provide it as a process environment variable. `.env` is Git-ignored. Run `npm run verify:qloo` to perform a private live search followed by a place-insights request; it prints only status, timestamp, endpoint host, and result counts, never the key or raw Qloo response. This verifies API access, **not** real-world itinerary feasibility. Do not commit the key, put it in a URL, or expose it to the browser. The direct HTTP adapter pins its destination to `https://hackathon.api.qloo.com`.

## Official Qloo harness: private local check

The [organizer's hackathon kit](https://github.com/qloo/qloo-hackathon-kit) documents `qloo exec` and `qloo mcp` for project workflows, plus `qloo api` for individual endpoints and read-only `qloo explore`. Its `integrate`, `plan`, and `build` modes are outside this event. RainRoute currently uses its own direct HTTP adapter; the commands below validate the official harness separately and do **not** prove that RainRoute's live route works.

After receiving an event-issued key, run these commands **locally** in PowerShell. The two base-URL variables configure the harness; the RainRoute HTTP adapter uses its pinned destination. The request file contains only the public cultural concept `jazz`.

```powershell
$env:QLOO_BASE_URL = 'https://hackathon.api.qloo.com'
$env:QLOO_TRUSTED_BASE_URL = 'https://hackathon.api.qloo.com'
npm install --global @qloo/qloo-harness
qloo --version # require 0.1.26 or newer
qloo setup --qloo # enter the issued key in this local interactive prompt
qloo setup --status
qloo exec find_tags --input-file examples/qloo-find-tags.request.json
```

The last command returns Qloo data to the local terminal. Review it privately; do not paste the output into a public issue, demo, log, or repository. For RainRoute's separate server adapter, supply the same **individually issued** key only through a local process environment variable or the ignored `.env`, then run `npm run verify:qloo` and `npm run verify:live-server`. The October 30 preflight returned 20 search candidates and 5 place insights. The local HTTP check reached Qloo through the LangGraph workflow and returned `VENUE_FACTS_UNVERIFIED` as designed. A working live route still needs independent evidence for hours, prices, travel times, and weather, followed by an end-to-end route test.

Never send user names, email addresses, device or account IDs, or location histories in demo queries. Use aggregate cultural concepts or public cultural entities, keep the key out of web/mobile bundles and recordings, and treat [Qloo affinity results](https://github.com/qloo/qloo-hackathon-kit/blob/main/docs/SAFE_USE.md) as cultural signals rather than facts about an individual or a venue's current operations. The [event access rules](https://github.com/qloo/qloo-hackathon-kit/blob/main/docs/API_ACCESS.md) require an individually attributable credential and bounded use.

## Architecture and evidence

`src/agent.cjs` contains the LangGraph sequence `resolve → discover → verify → replan → explain`. `src/planner.cjs` exhaustively evaluates three-stop combinations and enforces opening windows, closure, weather, budget, and finish time. `src/qloo-client.cjs` validates requests and handles authentication, rate limits, timeouts, and network errors. `src/catalogue.cjs` is exclusively synthetic fixture data. `public/` is the responsive interface. `scripts/build-static.cjs` packages its browser preview in `docs/` without requiring an API key.

`src/discovery.mjs` is the live discovery workflow. `src/hosted-worker.mjs` serves the hosted experience using the same workflow and explicit source labels; this lightweight Worker uses deterministic orchestration, while the local route path uses LangGraph. `scripts/build-hosted.cjs <absolute-sites-project-directory>` embeds only the specified public assets and source into a Worker. It never reads or bundles `.env`.

## Visitor and key budgets

The hosted deployment requires a D1 `DB` binding and a `quota_buckets` table (`key TEXT PRIMARY KEY, hits INTEGER NOT NULL DEFAULT 0, expires_at INTEGER NOT NULL`). Quota updates use an atomic conditional upsert. If quota protection is unavailable, discovery fails closed before contacting Qloo.

- Each anonymous browser gets 6 discovery attempts per UTC day, including cached results and failed attempts. The UI displays its remaining allowance and local reset time.
- Each network gets 30 attempts per UTC day to reduce cookie-reset abuse. Anonymous browser/network limits cannot prove a natural person's identity; shared networks share this cap.
- The entire service reserves at most 120 upstream Qloo HTTP requests per UTC day, two per uncached discovery workflow. Failed upstream calls conservatively retain their reservation.
- Same-seed results are cached in Worker memory for 30 minutes. A best-effort 12-request/minute network throttle and 30-workflow/minute isolate throttle supplement the durable daily limits.

The browser identifier is a same-site, secure, HttpOnly cookie. Stored counter keys contain a daily salted hash, not raw IP addresses, user names, or location histories. Neither browser identifiers nor network addresses are sent to Qloo. The local-only Node development server does not expose the hosted quota service and must not be published as an unprotected public proxy.

`npm test` covers the planner, server, Qloo request construction, and the guard against unverified live routes. `node scripts/qa-browser.cjs` checks the desktop and 390/320px UI states when Playwright is available; set `CODEX_PLAYWRIGHT_PATH` to a local Playwright installation if needed. Its screenshots are local artifacts and are excluded from Git.

## Limits

The hosted app provides live cultural discovery and candidate review. The static sandbox does not execute LangGraph or Qloo in the browser. Real itinerary generation remains blocked until independent operational facts are verified. Candidate ranking is cultural affinity, not geographic proximity or a probability about an individual. No booking, payment, navigation, or real-time weather feature is implemented.

Licensed under MIT. See [LICENSE](LICENSE).
