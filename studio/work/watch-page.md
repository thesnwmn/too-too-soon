---
title: The watch view, with countdowns
kind: build
role: engineer
size: M
status: trial
milestone: m1-first-trains
pr: 3
needs: [core-passes]
---

## Why
What the producer looks at by the bridge, phone in one hand and a child in the other.

## Done when
- A big countdown to the next train and its direction, then a short list of the ones after, each with clock time, "in N min", direction, what it is and how sure the time is.
- The countdown ticks every second; the list refreshes every 60 s while the page is visible (slower when nothing is within 10 minutes).
- The spot (name, A, B, f, direction labels) is in the URL and remembered on the phone; a simple form sets it up by typing timing point codes.
- `?demo` (and any build without a Worker) shows recorded data, so the page can be tried before the live API is set up.
- Installable on the home screen (a manifest and icon), readable in sunlight, works one-handed.

## Not this
Picking the spot on a map (`spot-picker`). "It's here!" (`its-here`).

## Log
- 2026-10-23 started, #3. The Tester's run (Chromium, phone width) found a bad form submit cleared what was typed, the fallback demo mixed the user's spot with demo names, and the "not set up" message had no link. All fixed. The Critic's page findings (ignored Retry-After, stale answers for a changed spot, no cancel, iPhone icon, a noisy live region) fixed too.
- 2026-10-23 merged, #3: waiting for a trip to the bridge. Try: is the countdown readable in sun, and is the list enough to choose when to walk down?
