# RainRoute

RainRoute is an explainable, constraint-first cultural itinerary prototype. It replans a three-stop route when rain, a late arrival, a closure, a smaller budget, or an earlier finish invalidates the original. It checks hard constraints before ranking the remaining routes and shows a clear no-solution state when none survive.

**Status:** This is a synthetic-data prototype, not a live travel service. Every demo venue, affinity score, coordinate, opening hour, price, walking estimate, and weather condition is invented. The static web demo runs the same deterministic planner as the local server. It does **not** call Qloo. The server has a separate Qloo adapter for entity search and place insights, but its live path deliberately stops before presenting an itinerary when operational venue facts have not been verified. The adapter has not yet been validated with an issued hackathon API key.

## Try the demo

The [browser demo](https://fowepjf255.github.io/RainRoute/) includes rainy-day replanning, a 90-minute delay plus closure, no solution, and a simulated candidate-retrieval failure. The interface is currently in Chinese; the [English walkthrough](DEMO_GUIDE_EN.md) translates its controls, states, and testing steps. The source files in `docs/` are a self-contained GitHub Pages build.

## Run locally

Requires Node.js 20 or newer.

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

The Qloo key stays on the server. When an official key is issued, put `QLOO_API_KEY=...` in a local `.env` copied from `.env.example`, or provide it as a process environment variable. `.env` is Git-ignored. Run `npm run verify:qloo` to perform a private live search followed by a place-insights request; it prints only the result counts and status, never the key or raw Qloo response. This verifies API access, **not** real-world itinerary feasibility. Do not commit the key, put it in a URL, or expose it to the browser. Hackathon keys are intended for `https://hackathon.api.qloo.com`.

## Architecture and evidence

`src/agent.cjs` contains the LangGraph sequence `resolve → discover → verify → replan → explain`. `src/planner.cjs` exhaustively evaluates three-stop combinations and enforces opening windows, closure, weather, budget, and finish time. `src/qloo-client.cjs` validates requests and handles authentication, rate limits, timeouts, and network errors. `src/catalogue.cjs` is exclusively synthetic fixture data. `public/` is the responsive interface. `scripts/build-static.cjs` packages its browser preview in `docs/` without requiring an API key.

`npm test` covers the planner, server, Qloo request construction, and the guard against unverified live routes. `node scripts/qa-browser.cjs` checks the desktop and 390/320px UI states when Playwright is available; set `CODEX_PLAYWRIGHT_PATH` to a local Playwright installation if needed. Its screenshots are local artifacts and are excluded from Git.

## Limits

The static preview does not execute LangGraph or Qloo in the browser; it is a planner and interface demonstration. Live route planning requires an issued Qloo key and independent sources for real-world venue facts. No booking, payment, navigation, or real-time weather feature is implemented.

Licensed under MIT. See [LICENSE](LICENSE).
