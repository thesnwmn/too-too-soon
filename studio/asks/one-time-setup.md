---
title: Will you set up the free accounts and secrets the live site needs?
from: release
status: answered
blocks: [go-live]
default: None. Until it's done, the site runs only as a demo with recorded trains.
gated: true                 # accounts and secrets only the producer can create
---

The live site needs three things only you can do: a Realtime Trains API token (free for personal use), a free Cloudflare account to run the Worker that holds it, and those put in this repo's GitHub secrets. Then every merge to `main` deploys it, with no terminal needed. Steps, about 20 minutes: [one-time setup](../producer-guide.md#one-time-setup).

While you do it, it's worth checking one thing on the API portal: whether your plan includes **detailed mode** (`allowDetailed`). Without it, RTT probably only lists trains that stop, and the passing trains (and most freight) are missing. Once the Worker is deployed, `/api/info` says so.

Options:
- **Do it now** (recommended), then say so with `/needs-me` or `/director`.
- **Later**: the studio carries on building, and the demo shows what it'll look like.

## Answer
2026-10-23: "I've set up things, can you try?", then "I've changed the RTT token" (the first secret was the token's ID; RTT said so through `/api/info`). The Worker is live at too-too-soon.justin-fc2.workers.dev with a refresh token that swaps fine. The token has no entitlements, so no detailed mode: see [detailed-mode](detailed-mode.md).
