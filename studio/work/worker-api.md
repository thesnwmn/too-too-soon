---
title: The Worker, holding the token and answering /api/next
kind: build
role: engineer
size: M
status: shaped
milestone: m1-first-trains
needs: [core-passes]
---

## Why
RTT's terms forbid the token in the page, so a small Cloudflare Worker calls RTT and hands the page only the list it shows ([architecture](../../docs/architecture.md)).

## Done when
- `GET /api/next?a=&b=&f=` fetches A and B in detailed mode (from 15 minutes ago, 90 minutes ahead), joins them with `packages/core`, and returns the passes as small JSON.
- Responses are cached for 60 s per A+B; a 429 or an RTT error serves the last good list, marked stale.
- A refresh token is swapped for an access token and kept until it expires.
- `GET /api/info` says whether the token works and whether it has detailed mode, without showing the token.
- Inputs are validated (TIPLOC-shaped codes, 0 ≤ f ≤ 1).
- The Worker also serves the built page, so there's one URL and no CORS.
- Tests run the Worker's handler against recorded RTT responses with a fake fetch.

## Not this
Deploying (`deploy`). Spot lookup on a map (`spot-picker`).

## Log
