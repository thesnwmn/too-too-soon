---
title: The live site works at our bridge
kind: test
role: tester
size: S
status: ready
milestone: m1-first-trains
needs: [deploy, one-time-setup, our-bridge, detailed-mode]
---

## Why
The milestone's exit: real trains, real bridge.

## Done when
- `/api/info` on the live Worker says the token works and has detailed mode (passing trains). If it doesn't, an ask for the producer: the paid plan or the Network Rail route.
- The producer's spot is set up and its link is in their hands.
- A trip report says whether the trains came when it said.

## Not this
Accuracy tuning (`its-here`).

## Log
- 2026-10-23 first deploy (producer set up the accounts): the Worker is live and has the token, but RTT answers 401. #6 tidies the pasted token and makes `/api/info` say how it was taken and what RTT said; `probe.yml` reads it from GitHub's runners, since sessions can't reach workers.dev.
- 2026-10-23 with the right token (the first was the token's ID): `/api/info` ok, swapped as a refresh token, entitlements `[]` (no detailed mode). The probe got 13 real trains Clapham Junction to Earlsfield, all stopping at both, an hour out: the live API's times have no offset. #7 reads them as UK time.
- 2026-10-23 after #7: times right (at 00:21 UK time the next trains showed 00:22, 00:23 …). Still only trains stopping at both ends: new ask `detailed-mode`.
- 2026-10-23 the producer sent their bridge as a Google Maps short link; sessions can't reach Google, so `probe.yml` learned `place` (a map link or lat,lon): it finds the timing points with `locate` on GitHub's runners and probes them.
- 2026-10-24 the producer's bridge: 51.30831, -0.59407, 100 m from the South West Main Line between Woking and Brookwood. OSM has no `ref:tiploc` within 8 km there, so the picker now falls back to stations' `ref:crs` (#14).
- 2026-10-24 ready: detailed mode is on (RTT+), and the bridge is BKO to WOK, f 0.52. Left: a daytime probe there, and a trip report.
