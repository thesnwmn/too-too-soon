---
title: First trains at our bridge
status: current
---

## Why
The producer wants a free, running version to use as soon as possible: pick a spot on the railway, see the next trains that should pass it, with a countdown. See [the notes](https://github.com/thesnwmn/notes/tree/main/too-too-soon).

## Scope
- The studio harness, cut down from pixelbob.
- The prediction core: join the trains at the timing points either side of the spot and interpolate.
- The Worker: holds the RTT token, answers `/api/next`, caches, serves the page.
- The page: a watch view with countdowns, the spot in the URL, a demo mode with recorded data.
- Deploys: the Worker on Cloudflare's free plan from GitHub Actions; a demo build on GitHub Pages.
- Picking the spot on a map.

## Exit criteria
- The producer opens the site on their phone at the bridge and it lists the trains that really come, within a couple of minutes.
- It costs nothing to run.
- `pnpm health` is green on main.
