---
title: Deploy the Worker and a demo build from GitHub Actions
kind: release
role: release
size: S
status: done
milestone: m1-first-trains
pr: 4
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
- 2026-10-23 done, #4: `deploy.yml` (Worker and page to Cloudflare, `RTT_TOKEN` piped into the Worker's secrets, the address and `/api/info` in the run's summary) and `pages.yml` (the demo). Each says what's missing and stops, rather than failing, until the one-time setup is done; so neither has really deployed yet. `go-live` is where that's proven. New check: `code/wrangler`.
- 2026-10-23 review: the Critic found a failed `wrangler deploy` would pass (no pipefail behind `tee`); fixed, and each secret now reaches only the step that uses it, the summary waits for the new version, and the Pages job no longer makes an empty deployment before Pages is on.
