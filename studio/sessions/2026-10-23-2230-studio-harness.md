---
date: 2026-10-23
command: (request) steal the harness from pixelbob, propose roles, get on without guidance
units: [studio-harness]
pr: 1
session: https://claude.ai/code/session_01RTyz9cKWQ8jtgcBNvA8cTR
health: green at end
size: M planned; about a third of the session
---

## Summary
Initialised the repo with a README, then brought in pixelbob's studio harness cut down to six roles, and planned the first milestone: a free, running site at the producer's bridge.

## The producer said
- "Steal the harness for implementation from the pixelbob repo. We don't need all the same roles. Propose which ones you want. I want you to get on as much as you can without my guidance so I end up with a free, running version of this for me to use asap."
- They made `main` require PRs while this ran.

## Done
- Roles: director, designer, engineer, tester, critic, release ([why](../../docs/decisions/2026-10-23-harness-from-pixelbob.md)). `/playtest` became `/trip`.
- Health check and board ported with their tests; the gate, docs-in-step, studio page and previews left as ideas.
- Hosting: one Cloudflare Worker for the page and the API, plus a demo on Pages ([why](../../docs/decisions/2026-10-23-one-worker.md)).

## Learned
- This container can't reach `data.rtt.io` or Overpass (the proxy refuses them), but can read the RTT API spec on GitHub. So the code is built against the spec with fixtures, and the first real call happens from the deployed Worker (`/api/info`).

## Left for next time
`core-passes` is ready. The one-time setup ask is the only thing between the built site and a live one.
