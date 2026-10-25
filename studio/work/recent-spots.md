---
title: The page remembers your recent spots, to pick again with one tap
kind: build
role: engineer
size: S
status: doing
pr: 26
---

## Why
The producer, 2026-10-25, via /director: "provide a memory of previous spots". The page remembers only the last spot (`too-too-soon:spot` in localStorage), so going back to a bridge you used last week means searching for it again.

## Done when
- Each spot you watch is remembered on this phone, newest first, up to 5; watching one again moves it to the top, not a second copy (same `a`, `b` and `f`).
- The set-up form opens with "Your spots": each by its name, one tap to watch it. The form for a new spot follows below.
- Each remembered spot can be forgotten (a small ✕), with no confirm dialog.
- The spot already remembered under `too-too-soon:spot` carries over as the first recent spot.
- Demo spots and spots from a shared link you only glanced at are not remembered until you watch them (as now: `useSpot(spot, save)`).
- Private browsing or blocked storage: no list, nothing breaks.
- Tests for the list (add, move to top, cap, forget, the carry-over) with a fake storage; checked at 390×844 and 360×640 by the Tester.

## Not this
Accounts or sync between phones; renaming spots; a switcher on the watch view; maps of saved spots. The shared link still works for moving a spot to another phone.

## Log
- 2026-10-25 shaped by the Director from the producer's /director, with defaults (5 spots, on the set-up form, this phone only) the producer can change.
