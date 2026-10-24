---
title: A spot can be just one station or timing point
kind: build
role: engineer
size: M
status: trial
pr: 24
needs: [places]
---

## Why
The producer, 2026-10-24: "Should be able to select just a station/timing point (and name comes from the point) rather than between two." Watching from a station platform, or a bridge right by one, there's nothing to interpolate.

## Done when
- The set-up form takes one place, with "between two" as the other choice; the spot's name defaults to the place's name.
- The watch view lists the trains at that point: arriving, leaving, or passing (the time each is there), with which way each is going (towards its destination, or the next place it calls), freight included.
- A one-point spot's link has no `b` and no `f`, and old two-point links still work.
- Tests: core with recorded-shape fixtures (calls, passes, starts and terminates at the point); the Worker asks RTT once per refresh for one point.

## Not this
Platform numbers; splitting arrivals and departures into two lists.

## Log
- 2026-10-24 shaped by the Director from the producer's word; designer's eye on the form, engineer builds.
- 2026-10-25 built (#24): `predictAt` in core (each train when it's at the point: departure, pass, or arrival where it ends; a reversing train's way out), one line-up per refresh in the Worker, links with no `b` and no `f`, the set-up form's "One place / Between two" (a new spot starts with one), and the demo at one point (`?demo&a=ASHBYJN`). Critic: a train ending at the point pointed at itself (now "ends here", "4 coaches from London Waterloo"), and starts and ends weren't tested (now are). Tester: a "Between X and Y" name survived a switch to one place (now gives way), the name's placeholder didn't follow the choice. Left: the map picker by hand on a phone (it sets "Between two"). [Session](../sessions/2026-10-25-0030-one-point.md).
