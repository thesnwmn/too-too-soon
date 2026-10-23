# The studio

How a small team of agents builds Too Too Soon, with one human as producer and the person who takes it to the bridge. It's the harness from [pixelbob](https://github.com/thesnwmn/pixelbob/blob/main/studio/README.md), cut down to what a small web app needs ([why](../docs/decisions/2026-10-23-harness-from-pixelbob.md)). The [producer guide](producer-guide.md) is the same thing from the producer's side: what you type, what you get back.

## TL;DR

```
 producer ──"/go", "/needs-me", "/director …"──►  Director  ── reads ──►  studio/ (the board, on main)
    ▲                                                  │                        + open PRs + open issues (bugs)
    │                                                  │ picks one unit, wears the right hat
    │                                                  ▼
    │                         Designer · Engineer · Tester · Release
    │                                                  │
    │                                                  ▼
    │                         branch → PR → checks → Critic (fresh eyes) → squash-merge
    │                                                  │
    └──── the live site, and what to try on the next trip to the bridge ◄─┘
```

- **One way in.** Everything the producer says goes to the **Director**, who asks what you mean when it isn't clear, then routes it.
- **"go" is enough.** `/go` picks the most valuable next unit from the board, does it, ships it as a PR, merges it and says what it needs from you, if anything.
- **Never blocked on the producer.** Anything that needs you is an **ask** with a default. Work carries on with the default where that's reversible.
- **All state is in the repo.** `studio/` holds the board as one file per unit, the asks, milestones, session logs and trip reports. Decisions go in `docs/decisions/`.
- **Main is the truth.** Every session ends with its work merged to main, finished or not: unfinished code lands switched off, a failed attempt lands as a handoff note.
- **Healthy in, healthy out.** Every session starts and ends on `pnpm health`, and CI runs the same script.
- **The token never leaves the Worker.** The one rule from Realtime Trains that would get us cut off. The health check scans the page for it.

## Where it runs

Claude Code cloud sessions with GitHub access. There's no long-running agent: a session is the unit of execution, the container is thrown away afterwards, and the repo is the only memory. So every session that changes anything ends by writing down where it got to, in its [session log](#session-logs).

## Repo structure

```
too-too-soon/
  README.md                 what it is, how to run it
  CLAUDE.md                 conventions every session follows

  docs/                     THE APP: how it works and why
    README.md               index
    how-it-works.md         from a spot on the map to "next train in 4 minutes"
    architecture.md         the Worker, the page, hosting, the token rule
    decisions/              one record per decision

  studio/                   HOW IT'S MADE: the harness and its state
    README.md               this doc
    producer-guide.md       the producer's side
    producer.md             the producer's settings, standing rules, taste notes
    direction.md            current milestone, priorities, what's off the table
    milestones/ work/ asks/ sessions/ trips/
    board.ts                reads the files and prints the board (`pnpm board`)

  packages/                 shared libraries
    core/                   RTT types, the join and the time sum; no DOM, no fetch
  worker/                   the Cloudflare Worker: /api/*, holds the token, serves the page
  web/                      the page: a Vite app, installable as a PWA

  scripts/
    health/                 the health check and its checks (`pnpm health`)
  .claude/                  the studio's wiring: role briefs (agents/) and commands (skills/)
  .github/
    workflows/              CI, the PR title check, the deploy (Worker), the demo (Pages), and the probe of the live site
    scripts/                the deploy summary and the probe, in Node
    pull_request_template.md
```

A new top-level folder is a decision: it gets a record and goes in the map above. The health check fails on a top-level folder the map doesn't list.

## The studio's state

Each file starts with front matter: `key: value` lines between `---`, where a value is text, a number, `true` or `false`, or a list `[a, b]`, and `#` starts a comment. `studio/board.ts` reads and checks them, and the health check runs it, so a file that doesn't follow its format, or names a unit, ask or milestone that doesn't exist, turns the check red. One file per unit and per ask, never a shared list, so parallel branches don't conflict.

### A unit of work

`studio/work/<slug>.md`. The slug is the ID.

```markdown
---
title: Watch view with countdowns
kind: build            # think | shape | spike | build | fix | test | tidy | release
role: engineer         # who does it
size: M                # S = half a session, M = one; nothing bigger starts
status: ready          # idea | shaped | ready | doing | review | trial | done | dropped
milestone: m1-first-trains
needs: [core-passes]   # asks or units that must land first
pr: 4                  # set when it starts
---

## Why
## Done when
## Not this
## Log
```

```
idea ─► shaped ─► ready ─► doing ─► review ─► (trial) ─► done
   └──────────┴────────┴────────┴─────────┴────────────► dropped (with why)
```

- **shaped** has *Done when* and *Not this*, a size and a role; **ready** has nothing open in `needs`.
- **doing** and **review** exist only while a session runs.
- **trial**: merged, waiting for the producer to try it on a trip to the bridge, when it's about what it's like to use.
- **done** or **dropped**, always with a last log line saying why.

### An ask

`studio/asks/<slug>.md`: a question only the producer can answer.

```markdown
---
title: Which bridge?
from: designer
status: open                   # open | answered (with an ## Answer section) | expired
blocks: [go-live]              # each of these lists the ask in its needs
default: You set the spot up yourself on the page.
expires: after 3 sessions      # then the default stands
gated: false                   # true: nothing proceeds without you
---
Context, options, a recommendation.
```

### A milestone

`studio/milestones/<slug>.md`: `title` and `status` (`proposed`, `current`, `done` or `dropped`; one current at a time), then *Why*, *Scope* and *Exit criteria*.

### Direction and the producer file

`studio/direction.md` names the current milestone (`milestone: …`) and says what's now, next and off the table. `studio/producer.md` holds the autonomy level (`autonomy: studio-merges` or `review-first`), standing rules and taste notes. Both are the producer's: the studio proposes changes to them, it doesn't make them on its own.

### Session logs

`studio/sessions/<date>-<HHMM>-<slug>.md`, with the UTC time: front matter `date`, `command`, `units`, `pr`, `session`, `health`, `size`; then *Summary*, *The producer said*, *Done*, *Tried and dropped*, *Learned*, *Left for next time*. A page at most. Every session that changes something writes one, or its PR says `Session log: none, because …`.

### Trip reports

`studio/trips/<date>-<HHMM>-<slug>.md`: what happened when the producer used it at the bridge, written by `/trip`. Front matter `date`, `by`, `build`, `spot`, `units`, `issues`, `useful` (1 to 5) and `accuracy` (`early`, `right`, `late` or `mixed`); then *What they said*, *Wrong*, *Liked, and would change*.

### PRs

A PR's title becomes the squash commit on main: `type(scope)!: Summary`, conventional commits, the summary starting with a capital and no full stop, checked by the `pr-title` workflow.

| Type | For |
|---|---|
| `feat` | Something new you can use |
| `fix` | Something that was wrong now isn't |
| `spike` | A throwaway answer to one question |
| `docs` | Docs and plans |
| `test` | Tests and fixtures |
| `refactor` / `perf` | Same behaviour, better or faster code |
| `chore` | Dependencies, studio bookkeeping |
| `ci` | Workflows and deploys |

Scopes (optional): `core`, `worker`, `web`, `studio`, `health`, `docs`. The description follows `.github/pull_request_template.md`: Why, Session, What, Try it, Docs, Health, Next. Short.

## The roles

Each role is a brief in `.claude/agents/<role>.md`. A session either wears the hat (reads the brief and does the work) or runs the role as a subagent when independence matters (the Critic) or the output is bulky (the Tester).

| Role | Does | May change | Never |
|---|---|---|---|
| **Director** | Your one point of contact. Understands, routes, keeps the board and direction, picks what `/go` does, sizes and splits. | `studio/`, `docs/decisions/` | Write app code. Decide taste for you. |
| **Designer** | What it's like to use at the bridge with a child: the watch view, the set-up, the words. Shapes ideas into units. | `docs/`, `studio/work/`, the page's copy and layout | Ship logic beyond the page's look and words. |
| **Engineer** | Production code: `packages/core`, `worker/`, `web/`. Reproduces before fixing, tests with the change. | `packages/`, `worker/`, `web/`, tests | Put the RTT token anywhere but the Worker's secrets. |
| **Tester** | Fixture-driven checks of the predictions, the Worker against recorded RTT responses, a browser smoke test of the page. Reports, doesn't fix. | tests, fixtures, `studio/trips/` | Fix what it finds. |
| **Critic** | Independent review of every PR before merge: correctness, the conventions, tests that test the claim, docs still true, scope. | PR comments | Push code. |
| **Release** | Deploys: GitHub Actions, the Worker on Cloudflare, Pages, secrets wiring, the health check's CI. | `.github/`, `worker/wrangler.toml` | Add a secret's value anywhere but a secret store. |

Roles are added when the work needs them, by a decision record. pixelbob's Muse, Art director, Planner, Prototyper and Toolsmith aren't here: the Director plans, the Engineer spikes, and the Designer covers the look.

## Invocation

What every session does on `/go`:

0. **Health check.** `pnpm health`. If it's red, this session fixes that and nothing else.
1. **Sync.** `producer.md`, `direction.md`, `pnpm board`, open PRs and their comments, CI on main, open issues.
2. **Pick** the next unit, in this order: main broken; the producer's unhandled input; bugs; the current milestone's next ready unit, riskiest first; shaping when fewer than about three units are ready.
3. **Claim.** Set the unit to `doing`, push, open a PR, record its number.
4. **Work** in the role's hat. Fixes reproduce first.
5. **Check.** `pnpm health --quick` as often as useful.
6. **Review.** The Critic as a subagent, with only the unit and the branch. Fix its blocking findings.
7. **Ship.** The unit's status and log, the docs that describe what changed, a session log, the PR description.
8. **Health again.** `pnpm health --end`, with everything pushed.
9. **Merge.** CI green, then squash-merge (if `autonomy: studio-merges`).
10. **Report** in about five lines: what was done, the link, what's waiting on you.

**Stop signs:** the context has been compacted once and the work isn't near done; two approaches have failed; the diff is heading past about 800 lines. Then land what works, write the handoff and split the rest.

## Health

`pnpm health` answers one question: is this repo ready to develop on? Sessions start on it, end on `pnpm health --end`, and CI runs it on every PR and push to main, and nightly.

| Tier | Checks |
|---|---|
| **1. Tools** | Node is the version `.nvmrc` pins; pnpm matches `packageManager`; git. |
| **2. Dependencies** | Install from the lockfile; every workspace package resolves its dependencies. |
| **3. Repo** | On a session branch, not `main`; no conflict markers; every top-level folder is in the [repo map](#repo-structure); how far behind `main`. At the end (`--end`): tree clean, everything pushed, a PR for the branch. |
| **4. Code** | The token rule (`code/no-token-in-page`: no RTT host, token or auth header in `web/`); no DOM or fetch in `packages/core`; the Worker's config serves the page and holds no secrets (`code/wrangler`); only the map picker loads MapLibre, lazily (`code/map-lazy`); `pnpm typecheck`, `pnpm test`, `pnpm build` (the page, and the Worker's dry-run deploy). |
| **5. Studio and docs** | Every studio file follows its format (`studio/files`); no unit left `doing` on main; every role has a brief and a row in the roles table; every command a skill and a section in the producer guide; every doc is in `docs/README.md`; every relative link resolves. |

- `--quick` skips the slow checks (the build). The session start hook in `.claude/settings.json` runs it, and never fails the session start.
- **Whatever a PR adds, it checks.** A new tool, format or convention gets a check in `scripts/health/`, with a test that feeds it a broken fixture.
- A check is never deleted or skipped to get green.

## Autonomy

Set in `producer.md`. **Studio merges** (chosen): every session squash-merges its own PR once CI is green and the Critic has nothing blocking. **Review first**: you merge every PR.

Changes to `producer.md`, `direction.md` and the milestones are the producer's calls: the studio opens them as their own PR and asks, rather than merging them.

## Not yet

Things pixelbob's studio has that this one leaves until they're needed, each an idea on the board: PR previews, the studio page on Pages, the docs-in-step check, and the gate check for gated files.
