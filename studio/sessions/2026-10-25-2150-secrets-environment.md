---
date: 2026-10-25
command: none (the producer asked how safe the secrets are)
units: []
pr: 0
session: https://claude.ai/code/session_01AA5Bpx4DCoahuMe7tWKxgs
health: green at start and end
size: S
---

## Summary
The secrets moved from repository secrets (which any branch's workflow can read) to the `production` environment, which only `main` may use. The workflows that use them now say so, third-party actions are pinned to commits, and the site's address is out of the public repo.

## The producer said
"Can someone branch or fork and setup a deployment via modified CI that uses my credentials?" Then: made the `production` environment (branch rule `main`, no required reviewer), deleted the repo secrets, and asked for the address out of the README, as a secret.

## Done
- `deploy.yml` and `probe.yml` jobs run in `environment: production`; the probe's site is the `SITE_URL` secret unless given.
- The deploy masks the address before wrangler's output reaches the (public) log; the summary no longer prints it.
- `pnpm/action-setup` and `amannn/action-semantic-pull-request` pinned to commit SHAs.
- Health: `code/workflows` (a job that uses a secret is in `production`; non-GitHub actions pinned) and `code/no-site-address`.
- Tested before the change, on `main`: with the repo secrets still there, a job with no environment got `RTT_TOKEN` and a (stale) Cloudflare token.

## Learned
- Forks never got the secrets; branches in this repo did, which includes every studio session.
- The address is still in git history and old Actions logs: hiding it is only obscurity. Anyone with the link can use the site.

## Left for next time
- The producer adds `SITE_URL` to the `production` environment.
