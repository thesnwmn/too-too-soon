---
title: Search for a station or timing point by name
kind: build
role: engineer
size: M
status: ready
---

## Why
The producer, 2026-10-24: "Can we help search for stations/timing points so the user doesn't need to know the code?" Asked whether to search stations only or junctions too: "Both, stations first."

## Done when
- On the set-up form, typing a few letters ("wok") offers matching places, stations first, then junctions and other timing points ("Woking", then "Woking Junction" …). Picking one fills its code and its name.
- The list is RTT's own (`/data/locations_ungrouped`, plus `/data/stops` to tell stations apart), fetched with the token at deploy time (the token never reaches the page) and shipped as a small static file the page searches itself: no request per keystroke, works on a weak signal once loaded, and costs nothing per search.
- It's refreshed on every deploy, and on a weekly schedule.
- Tests: searching a recorded-shape fixture; the file's size kept in check by the health check.

## Not this
Coordinates or a map (that's `picker-offline`); fuzzy spelling beyond simple prefix and word matching.

## Log
- 2026-10-24 shaped by the Director from the producer's word. RTT's spec has `/data/locations_ungrouped` (description, shortCode, longCode) and `/data/stops`.
