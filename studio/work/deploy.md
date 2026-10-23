---
title: Deploy the Worker and a demo build from GitHub Actions
kind: release
role: release
size: S
status: shaped
milestone: m1-first-trains
needs: [worker-api, watch-page]
---

## Why
Free and running without the producer touching a terminal: merges to main deploy.

## Done when
- On push to main, a workflow builds the page and deploys the Worker (with the page as its static assets) to Cloudflare with `wrangler`, using `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `RTT_TOKEN` from GitHub secrets. Without the secrets it skips with a clear message rather than failing.
- A workflow deploys the demo build to GitHub Pages.
- The README says where the site is.

## Not this
PR previews (an idea).

## Log
