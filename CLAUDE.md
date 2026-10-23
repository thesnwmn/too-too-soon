# Too Too Soon

A small web site for one job: pick a spot on the railway (a bridge you watch from) and get the next trains that should pass it, with a countdown. A pnpm TypeScript monorepo: `packages/core` (the prediction), `worker/` (the Cloudflare Worker that holds the Realtime Trains token and serves the page), `web/` (the page). Read `docs/README.md` for how it works. `studio/` is how it gets made: the agent harness (`studio/README.md`, with the repo map). What's next is on the board: `pnpm board`.

## Commands

- `pnpm install`, `pnpm typecheck`, `pnpm test`, `pnpm build`
- `pnpm health` is the health check (tools, install, repo, code, studio): sessions start on it, sessions that change anything end on `pnpm health --end`, and CI runs it. `--quick` skips the slow checks, for use while working. See `studio/README.md#health`.
- Run `pnpm health --quick` before committing.
- The studio's commands (`/go`, `/next`, `/needs-me`, `/director`, `/trip`, `/board`) are skills in `.claude/skills/`, and its roles are subagents in `.claude/agents/`. A session that's asked for one follows its skill; a session doing a unit reads its role's brief first.
- `pnpm board` prints the studio's board from the files in `studio/`. Its formats are in `studio/README.md#the-studios-state`.
- Whatever a change adds (a tool, a dependency, a format, a convention), it adds a check for in `scripts/health/`, with a test that feeds it a broken fixture.

## Workflow

- Never push to `main`. Every change goes on a branch and lands through a pull request, merged with **squash merge**.
- PR titles become the squash commit message, so they follow `type(scope)!: Summary` (conventional commits, summary starting with a capital), checked by the `pr-title` workflow. Types and scopes are in `studio/README.md#prs`.

## Conventions

- **The token rule.** The Realtime Trains token lives only in the Worker's secrets (`RTT_TOKEN`). Nothing in `web/` talks to `data.rtt.io` or carries a token or auth header; the page only calls the Worker's `/api/…`. RTT revokes tokens found in pages. The health check (`code/no-token-in-page`) enforces it.
- `packages/core` has no DOM and no fetch: it's pure functions over RTT's JSON, so it runs in the Worker, the page and Node tests.
- Tests never call the live API: they use recorded-shape fixtures and a fixed clock.
- RTT's live API sends UK wall-clock times without an offset (its spec allows one): read them with `rttTime` in `packages/core`, never `Date.parse`. Work in epoch milliseconds inside, and format for `Europe/London` only for display.
- Only erasable TypeScript syntax (no enums, no parameter properties): `erasableSyntaxOnly` is on so Node can run `.ts` files directly.
- Free to run: Cloudflare's and GitHub's free tiers, RTT's free personal plan. Respect RTT's rate limits: the Worker caches per spot.
- Credit Realtime Trains, Network Rail and OpenStreetMap where their data shows.
