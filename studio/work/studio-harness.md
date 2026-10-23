---
title: The studio harness, cut down from pixelbob
kind: tidy
role: director
size: M
status: done
milestone: m1-first-trains
pr: 1
---

## Why
The producer wants the site built with as little of their guidance as possible. Pixelbob's harness (health check, board, roles, commands) is how sessions do that without losing their way.

## Done when
- `pnpm health` runs the tools, deps, repo, code and studio tiers, with a test per check.
- `pnpm board` prints this milestone's units and asks.
- Six role briefs and six commands, each in the studio README and the producer guide.
- CI runs `pnpm health`; the PR title check runs.

## Not this
PR previews, the studio page, the docs-in-step and gate checks (ideas on the board).

## Log
- 2026-10-23 done, #1: harness ported with six roles; [session log](../sessions/2026-10-23-2230-studio-harness.md).
