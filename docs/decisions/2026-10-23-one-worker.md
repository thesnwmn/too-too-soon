# One Worker serves the page and the API

**Status:** accepted, 2026-10-23.

## The question
Where does the site run, for free, given that the Realtime Trains token must stay on a server?

## What we chose
One **Cloudflare Worker** on the free plan serves both the built page (as static assets) and `/api/…`. It's deployed from GitHub Actions with `wrangler` on every merge to `main`, using secrets the producer adds once. A **GitHub Pages** build of the same page runs in demo mode with recorded data.

- One URL, same origin: no CORS, and no API address to configure in the page.
- The free plan's 100,000 requests a day is far more than one family needs, and it has a cache.
- The page works before any account exists, as the demo on Pages.

## Also considered
- **Pages for the page, a Worker for the API.** Two URLs, CORS, and the page needs to know the Worker's address at build time.
- **Vercel or Netlify functions.** Would work as well; Cloudflare was the notes' pick and its Worker cache fits.
- **An always-on box** (Raspberry Pi or a VM) with the Network Rail feeds. Only if RTT isn't enough; see the notes.

## What it means for later
The producer needs a Cloudflare account and an API token (the one-time setup). Moving host means moving `worker/` and the deploy workflow; `packages/core` and `web/` don't care.
