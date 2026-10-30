# RainRoute: English demo walkthrough

## Live Qloo discovery

Open the [live English experience](https://rainroute-cultural-agent.lunarsnail20.chatgpt.site). No login or API key entry is needed for a visitor. Choose a cultural seed and click **Discover places**. The server resolves that seed and calls Qloo place insights. Candidate names, descriptions, cultural tags, and response ranks come from Qloo; they are not the fixtures used by the separate planning sandbox.

Click **Inspect evidence** to see provider metadata and the facts still missing for a real trip. Click **Shortlist** on two candidates to compare their locations, tags, and verification checklists; remove either candidate to check session state. Change the seed and repeat to explore another cultural context. The closed-place filter excludes candidates for which Qloo reports `is_closed=true`; absence of that flag is not proof that a venue is currently open.

The source badge shows when the response was obtained and whether it was cached (30 minutes). Each anonymous browser has 6 discovery attempts per UTC day, with an additional shared-network cap of 30 and an upstream-service budget of 120 HTTP requests per day. The displayed reset time uses the visitor's timezone. A daily limit produces an explicit pause rather than synthetic fallback. These anonymous limits are by browser and network, not verified natural-person identity.

The four-stage live trail is **Resolve → Discover → Verify → Decide**. A real itinerary stays blocked because independent venue facts are missing. The separate synthetic planning sandbox below demonstrates the route decision process under explicit fixture constraints.

## Synthetic planning sandbox

Open the [interactive demo](https://fowepjf255.github.io/RainRoute/). This page is a **synthetic-data preview**. It does not call Qloo, a weather provider, a map, or a booking service. The venues and cultural affinity scores are invented to demonstrate the route decision process. The public repository contains a separate server-side Qloo adapter, verified against the hackathon API on October 30, 2026. We do not claim a live Qloo-powered itinerary.

## What you see

The first panel answers whether the current disruption still permits a three-stop day. The left panel sets the cultural theme, delay, finish time, total activity budget, one closed venue, rain, and a simulated candidate-retrieval failure. The central map compares the original route with a selected alternative; it is an illustrative street layout, not a real map. The right panel explains each replacement and the agent trace. Beneath it, the original and selected routes show timings and costs, followed by five separate hard-constraint checks.

The original departure is 13:00. Route evaluation includes walking and waiting for a venue to open. A route survives only if every stop is open during its full visit, no selected stop is closed, all stops are indoors when raining, activity cost is within budget, and the route ends on time. The planner evaluates all 27 three-stop combinations, ranks feasible routes by an invented cultural score and minimal changes, and shows at most three alternatives. The score is a demo ranking index, **not** a probability of personal preference.

## Run the four key states

1. **Sudden rain** (`突然下雨`): the two outdoor stops in the original route fail. The default display shows three alternatives and reports 12 feasible combinations. Select another branch to compare its cost, finish time, and replacements.
2. **90-minute delay** (`迟到 90 分钟`): this preset also closes the original second stop. The route is replanned against both disruptions, and the hard-constraint panel shows why the selected branch is feasible.
3. **Budget ¥15** (`预算降到 ¥15`): rain, a closure, and an earlier finish leave no feasible three-stop route. The page says so and disables adoption. It never silently drops a stop or invents business hours.
4. **Candidate retrieval failure** (`候选检索故障`): a simulated timeout produces no route and an explicit failure explanation. This is a failure-state demonstration, not an actual Qloo outage.

You can also choose `晴天原计划` (clear day), `胶片小馆关闭` (the original middle venue closes), or `下雨且迟到` (rain and delay). `应用变化并重规划` means “apply changes and replan.” `采纳当前分支` means “adopt this branch”; it stores a selection in the current page session only and does not book or pay for anything. `切换立体示意` changes the illustrative map angle. Click a venue name or map node to view its fixture facts.

## Source and verification boundaries

The public demo is built from the same `src/planner.cjs` code as the local Node.js app. The local app runs a LangGraph workflow (`resolve → discover → verify → replan → explain`) and contains a Qloo API adapter in `src/qloo-client.cjs`. Authenticated search and place-insights calls have succeeded locally, and a local live-mode check reached Qloo and stopped at `VENUE_FACTS_UNVERIFIED`. Because real-world venue facts have not been independently checked, live route planning remains blocked. Run `npm ci && npm test && npm start` from the repository to inspect the local path and tests. The static page shows the interaction and constraint behavior while live route planning remains unfinished.
