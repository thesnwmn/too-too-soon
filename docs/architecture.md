# Architecture

```
  Phone browser                           Cloudflare Worker (free plan)            Realtime Trains
  ─────────────                           ─────────────────────────────            ───────────────
  GET /            ──────────────────────► the built page (static assets)
  GET /api/next?a=A&b=B&f=0.4 ──────────► 1. cache hit? (60 s, per timing point)
                                          2. GET location A, B ───────────────────► data.rtt.io
                                          3. join, interpolate (packages/core)
           ◄──────────── small JSON list ─ 4. cache and return
  countdown ticks every second; refetch every 60 s while visible
```

## The token rule

Realtime Trains requires that the API token is **never** in a page or app: requests go through our own server, and tokens found in pages are revoked. So the token is a secret in the Worker (`RTT_TOKEN`), set from a GitHub secret at deploy time, and the page only ever calls `/api/…` on the same origin. The health check fails if `web/` mentions RTT's host, the token or an auth header.

## The Worker

`worker/`, TypeScript. It:

- answers `/api/next?a=&b=&f=` with the next passes, built by `packages/core`;
- caches each timing point's line-up for 60 seconds, and shares a lookup already under way, so several phones at one bridge (or two spots sharing a timing point) cost one lookup;
- swaps a refresh token for a short-life access token when it needs to, and keeps it until it expires (if RTT turns the swap down with 401 or 403, the token was an access token already);
- serves the last good list, marked stale, when RTT says `429` or fails, and otherwise always answers JSON with an error the page can show, never the platform's error page;
- answers `/api/info` with whether the token works and has detailed mode, never the token, and keeps that answer for five minutes so nobody can spend the quota on it;
- validates its inputs, so it isn't an open proxy;
- serves the built page as static assets, so there's one URL and no CORS.

## Rate limits

RTT's free plan was reported at about 10 requests a minute, 100 an hour and 1,000 a day. Each refresh is two requests, so one phone refreshing every 60 seconds for an hour is 120: over the hourly limit. The page refreshes every 60 s only when a train is within 10 minutes, and every 2 minutes otherwise, only while it's visible, and waits as long as RTT's `Retry-After` says after a `429`. The Worker's cache shares one lookup between phones.

The cache is a Map in the Worker's memory, in front of the Workers Cache API. On a `workers.dev` address the Cache API does nothing (it needs a custom domain), so for now phones share a lookup when they reach the same Worker instance, which is usual for a family at one bridge. A new instance also asks RTT once to swap the token. If the limits bite, a custom domain (or the paid RTT plan) is the fix.

## The page

`web/`, Vite and plain TypeScript. A watch view (a big countdown, the direction, then the next few trains), a set-up form, and a demo mode with recorded data that needs no Worker. Installable on the home screen.

The map picker is a separate chunk (MapLibre, about 1 MB), loaded only when it's opened (the health check's `code/map-lazy` keeps it that way). Map tiles come straight from OpenFreeMap and the railway overlay from OpenRailwayMap. The OpenStreetMap lookup for each tap goes through the Worker's `/api/osm`, which builds the Overpass query itself from the tapped point (GB only, the picker's two radii: it isn't an open proxy), says who it is (overpass-api.de turns away requests that don't), falls through to a second public server when one is busy, and streams the answer back unparsed (the free plan's CPU limit is 10 ms). Asked straight from a phone, a refusal comes back without CORS headers and the browser only says "Failed to fetch". Only the demo on Pages, with no Worker, asks Overpass directly. Each source is credited on the map.

## Hosting

One Cloudflare Worker serves the page and the API, deployed from GitHub Actions on every merge to `main` ([why](decisions/2026-10-23-one-worker.md)). The same page is also built to GitHub Pages in demo mode, so it can be tried before the accounts exist.
