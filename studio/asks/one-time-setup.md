---
title: Will you set up the free accounts and secrets the live site needs?
from: release
status: open
blocks: [go-live]
default: None. Until it's done, the site runs only as a demo with recorded trains.
gated: true                 # accounts and secrets only the producer can create
---

The live site needs three things only you can do: a Realtime Trains API token (free for personal use), a free Cloudflare account to run the Worker that holds it, and those put in this repo's GitHub secrets. Then every merge to `main` deploys it, with no terminal needed. Steps, about 20 minutes: [one-time setup](../producer-guide.md#one-time-setup).

While you do it, it's worth checking one thing on the API portal: whether your plan includes **detailed mode** (`allowDetailed`). Without it, RTT probably only lists trains that stop, and the passing trains (and most freight) are missing. Once the Worker is deployed, `/api/info` says so.

Options:
- **Do it now** (recommended), then say so with `/needs-me` or `/director`.
- **Later**: the studio carries on building, and the demo shows what it'll look like.
