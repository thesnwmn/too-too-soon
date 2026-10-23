---
name: go
description: Do the most useful next thing in the Too Too Soon studio - health check, sync, pick one unit from the board, do it in its role, review it, ship and merge a PR, report. Arguments steer it - "small", "anyway", or what to work on.
---

# /go

"Do the most useful next thing." You are the Director, then whichever role the unit needs. The design is `studio/README.md#invocation`; this is the checklist. Arguments: `$ARGUMENTS` (empty: your choice; `small`: an S unit; `anyway`: carry on past a red health check; anything else: steer the pick).

## 0. Health
`pnpm health`. If it's red, this session is now a `fix` unit for the failing check: say so in one line. Only `/go anyway` carries on, naming the failure in the PR and the report.

## 1. Sync
`pnpm board`, `studio/producer.md`, `studio/direction.md`, open PRs and their comments (especially the producer's), CI on main, open issues.

## 2. Pick
1. Main is broken (step 0, CI on main, a failed deploy).
2. The producer's input not yet handled: PR comments, answered asks that unblock something.
3. Bugs.
4. The current milestone's next ready unit, riskiest first.
5. Shaping, when fewer than about three units are ready.
6. Nothing obvious: the Tester hunts for bugs.

Say which unit and why in two or three lines. A small bug can be fixed straight from its issue, without a unit.

## 3. Claim
- If this branch's PR is already merged, restart the branch from `origin/main` first (keep its name).
- Set the unit's `status: doing`, push, and open a PR at once (title per `studio/README.md#prs`). Put its number in the unit's `pr`.

## 4. Work
- Read the role's brief in `.claude/agents/<role>.md` and work in that hat. Fixes reproduce first.
- Stop signs: context compacted once and not near done; two approaches failed; the diff heading past about 800 lines. Then land what works (switched off if unfinished), write the handoff in the unit's log, split the rest into new units.

## 5. Check
`pnpm health --quick` as often as useful. For anything the producer sees, run the **tester** subagent on the unit.

## 6. Review
Run the **critic** subagent with only the unit's path and the branch, never your reasoning. Fix its blocking findings; answer the rest on the PR.

## 7. Ship
- The unit: status (`done`, `trial`, back to `ready` with a handoff, or `dropped`) and a log line linking the session log.
- The docs that describe what changed; a decision record if it's expensive to reverse; a health check for anything new.
- The session log, `studio/sessions/<date>-<HHMM>-<slug>.md`.
- The PR description per `.github/pull_request_template.md`, short.

## 8. Health again
Push everything, then `pnpm health --end`. Its summary line goes in the PR description.

## 9. Merge
Wait for CI by subscribing to the PR's activity, not by polling. When CI is green on the latest commit: **squash-merge** (if `autonomy: studio-merges`). If main moved on, merge main in and check again first. A change to `producer.md`, `direction.md` or a milestone goes in its own PR, left open for the producer.

## 10. Report
About five lines:

```
Done: watch view (build, M) → PR #4, merged. Health: green at start and end.
Try it: https://…/?demo (1 min) Is the countdown big enough to read in sun?
Needs you: one-time setup (gated), our bridge (default: set it up yourself).
Next up: the Worker (M), then deploy (S).
```

If budget is left after an S unit, take a second S unit from a clean point.
