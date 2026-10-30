# RainRoute

RainRoute is an explainable, constraint-first cultural itinerary prototype. It replans a three-stop route when rain, a late arrival, a closure, a smaller budget, or an earlier finish invalidates the original. It checks hard constraints before ranking the remaining routes and shows a clear no-solution state when none survive.

**Status:** This is a synthetic-data prototype, not a live travel service. Every demo venue, affinity score, coordinate, opening hour, price, walking estimate, and weather condition is invented. The static web demo runs the same deterministic planner as the local server. It does **not** call Qloo. On October 30, 2026, the local server's Qloo adapter successfully made authenticated entity-search and place-insights requests against the hackathon endpoint. Its live path deliberately stops before presenting an itinerary when operational venue facts have not been verified.

## Try the demo

The [browser demo](https://fowepjf255.github.io/RainRoute/) includes rainy-day replanning, a 90-minute delay plus closure, no solution, and a simulated candidate-retrieval failure. The interface is currently in Chinese; the [English walkthrough](DEMO_GUIDE_EN.md) translates its controls, states, and testing steps. The source files in `docs/` are a self-contained GitHub Pages build.

## Run locally

The RainRoute server requires Node.js 20 or newer. The official Qloo hackathon harness below requires Node.js **22.19.0 or newer**.

```bash
npm ci
npm test
npm start
```

Open `http://127.0.0.1:3000/`. The server binds to localhost. API routes:

- `GET /api/health` returns the readiness flags.
- `GET /api/demo/catalog` returns the **synthetic** scenario catalogue.
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

`npm test` covers the planner, server, Qloo request construction, and the guard against unverified live routes. `node scripts/qa-browser.cjs` checks the desktop and 390/320px UI states when Playwright is available; set `CODEX_PLAYWRIGHT_PATH` to a local Playwright installation if needed. Its screenshots are local artifacts and are excluded from Git.

## Limits

The static preview does not execute LangGraph or Qloo in the browser; it is a planner and interface demonstration. Live route planning requires an issued Qloo key and independent sources for real-world venue facts. No booking, payment, navigation, or real-time weather feature is implemented.

Licensed under MIT. See [LICENSE](LICENSE).
