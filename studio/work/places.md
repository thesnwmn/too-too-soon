---
title: Search for a station or timing point by name
kind: build
role: engineer
size: M
status: trial
pr: 23
---

## Why
The producer, 2026-10-24: "Can we help search for stations/timing points so the user doesn't need to know the code?" Asked whether to search stations only or junctions too: "Both, stations first."

## Done when
- On the set-up form, typing a few letters ("wok") offers matching places, stations first, then junctions and other timing points ("Woking", then "Woking Junction" …). Picking one fills its code and its name.
- The list is RTT's own (`/data/locations_ungrouped`, plus `/data/stops` to tell stations apart), fetched with the token at deploy time (the token never reaches the page) and shipped as a small static file the page searches itself: no request per keystroke, works on a weak signal once loaded, and costs nothing per search.
- It's refreshed on every deploy, and on a weekly schedule.
- Tests: searching a recorded-shape fixture; the file's shape and size checked (`code/places`, and by the script before it writes it).

## Not this
Coordinates or a map (that's `picker-offline`); fuzzy spelling beyond simple prefix and word matching.

## Log
- 2026-10-24 shaped by the Director from the producer's word. RTT's spec has `/data/locations_ungrouped` (description, shortCode, longCode) and `/data/stops`.
- 2026-10-24 built (#23). RTT's lists (probe `sample` mode): `/data/stops` 2,623 stations (description, CRS), `/data/locations_ungrouped` 12,116 places (description, CRS for some, TIPLOC), 1.4 MB; shipped as 2,623 stations and 9,427 other timing points, 365 KB (123 KB gzipped). "Jn" reads as "junction"; a big station's platform TIPLOCs with its own name are left out. Critic: no check of the real file (`code/places` and the script now check shape and size); "Bath" typed would have gone to RTT as a code (now only a name in the list, a code in the list, or a code in capitals). Tester: a late list opening under a box you'd left, and keyboard and screen readers only getting the first suggestion (now a combobox: arrows, aria-activedescendant, a count read out); also retries a failed download and lifts the list above the phone's keyboard. Left for a trip: a real phone with the keyboard up, and VoiceOver. [Session](../sessions/2026-10-24-2300-places.md).
