# RainRoute: English demo walkthrough

Open the [interactive demo](https://fowepjf255.github.io/RainRoute/). This page is a **synthetic-data preview**. It does not call Qloo, a weather provider, a map, or a booking service. The venues and cultural affinity scores are invented to demonstrate the route decision process. The public repository contains a separate, still-unvalidated server-side Qloo adapter. We do not claim a live Qloo-powered itinerary.

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

The public demo is built from the same `src/planner.cjs` code as the local Node.js app. The local app runs a LangGraph workflow (`resolve → discover → verify → replan → explain`) and contains a Qloo API adapter in `src/qloo-client.cjs`. Because the API key has not yet been used and real-world venue facts have not been independently checked, live route planning is blocked. Run `npm ci && npm test && npm start` from the repository to inspect the local path and tests. The static page is provided to show the interaction and constraint behavior while that integration remains unfinished.
