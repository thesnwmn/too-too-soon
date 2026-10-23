# Too Too Soon: docs

What the site is, how it works and why. How it gets built is [the studio](../studio/README.md); the research behind it is in [thesnwmn/notes](https://github.com/thesnwmn/notes/tree/main/too-too-soon).

| Doc | What |
|---|---|
| [How it works](how-it-works.md) | From a spot on the map to "next train in 4 minutes": timing points, the join, the time sum, the edge cases |
| [Architecture](architecture.md) | The Worker, the page, hosting, the token rule, rate limits |

## Decisions

- [The harness, from pixelbob](decisions/2026-10-23-harness-from-pixelbob.md): which roles and commands, and what was left out.
- [One Worker serves the page and the API](decisions/2026-10-23-one-worker.md): Cloudflare's free plan, and a demo on GitHub Pages.
