# The harness, from pixelbob

**Status:** accepted, 2026-10-23.

## The question
The producer asked for the agent harness from [pixelbob](https://github.com/thesnwmn/pixelbob/blob/main/studio/README.md), without all its roles, so the site gets built with as little of their guidance as possible.

## What we chose
The same loop and formats (units, asks, milestones, session logs in `studio/`; `pnpm health` at the start and end of every session and in CI; `/go` picking, building, reviewing with a fresh-eyes Critic, and merging), with six roles instead of eleven:

| Kept | Why |
|---|---|
| **Director** | The one point of contact, and the planner: a small app doesn't need a separate Planner. |
| **Designer** | What it's like to use at a bridge with a child matters more than anything clever, and covers the look (no Art director). |
| **Engineer** | Writes the code, and does the occasional spike (no Prototyper). |
| **Tester** | Fixture runs and a browser smoke test, so predictions are checked without a trip to the bridge. |
| **Critic** | Independent review before every merge: the cheapest protection with no human reviewer. |
| **Release** | Deploys and secrets, the part most likely to go wrong quietly. |

Dropped: **Muse** (no open-ended creative search), **Art director** (folded into the Designer), **Planner** (the Director), **Prototyper** (the Engineer), **Toolsmith** (the Engineer and Release).

The commands are the same six, with `/playtest` renamed `/trip`: a report from a trip to the bridge. Trip reports replace playtest reports, rated on usefulness and accuracy rather than fun and difficulty, and the `playtest` status is `trial`.

## Also considered
- **The whole harness.** Its gate check, docs-in-step check, studio page and PR previews earn their keep on a big project with many sessions. Here they'd be most of the first week's work. They're ideas on the board, to add when they'd pay.
- **No harness.** Faster for a day, but nothing would keep later sessions on track without the producer.

## What it means for later
A role or a check comes in by a decision record and a PR, when the work needs it.
