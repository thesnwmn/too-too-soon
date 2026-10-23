---
title: The Worker, holding the token and answering /api/next
kind: build
role: engineer
size: M
status: done
milestone: m1-first-trains
pr: 3
needs: [core-passes]
---

## Why
RTT's terms forbid the token in the page, so a small Cloudflare Worker calls RTT and hands the page only the list it shows ([architecture](../../docs/architecture.md)).

## Done when
- `GET /api/next?a=&b=&f=` fetches A and B in detailed mode (from 15 minutes ago, 105 minutes ahead, or RTT's default hour if the token isn't allowed a longer window), joins them with `packages/core`, and returns the passes as small JSON.
- Line-ups are cached for 60 s per timing point; a 429 or an RTT error serves the last good list, marked stale.
- A refresh token is swapped for an access token and kept until it expires.
- `GET /api/info` says whether the token works and whether it has detailed mode, without showing the token.
- Inputs are validated (TIPLOC-shaped codes, 0 ≤ f ≤ 1).
- The Worker also serves the built page, so there's one URL and no CORS.
- Tests run the Worker's handler against recorded RTT responses with a fake fetch.

## Not this
Deploying (`deploy`). Spot lookup on a map (`spot-picker`).

## Log
- 2026-10-23 started, #3, with `watch-page` (they share the response format and were tested together).
- 2026-10-23 review: the Critic found that an unexpected error gave the platform's HTML error page (which the page took for "no Worker" and showed the demo), that a failed token swap was remembered as an access token, and that token expiry wasn't tested. All fixed and tested; `/api/info` is kept for five minutes, lookups in flight are shared, and the Cache API's no-op on workers.dev is documented.
- 2026-10-23 done, #3. Not tested against the live API: this container can't reach it. `go-live` checks it.
