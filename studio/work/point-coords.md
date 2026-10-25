---
title: Every timing point has a place on the map
kind: build
role: engineer
size: S
status: ready
milestone: m1-first-trains
---

## Why
For `find-on-map`, the producer, 2026-10-25, via /director: "on the map picker can we show all timing points clearly". The places list (`places`) has names and codes but no coordinates, and RTT's lists have none. OpenStreetMap tags few of them (no `ref:tiploc` within 8 km of the producer's bridge), so the map needs another source.

## Done when
- The deploy builds `places.json` (or a file beside it) with a latitude and longitude for each timing point it can place, joined by TIPLOC, and the kind it already knows (station, junction, other).
- The source is open data needing no paid account: first try Network Rail's BPLAN location records (TIPLOC, easting and northing, timing point type; Open Government Licence), then NaPTAN's rail references (stations only, TIPLOC, CRS, easting and northing), with OSM's station points last. Eastings and northings converted to latitude and longitude at build time, in the script.
- How many points got a place and how many didn't is printed by the script, and checked by `code/places` (or a new check) with a broken fixture: a point far outside Great Britain, or a file with almost none placed.
- Spot checks: Woking, Brookwood and Woking Junction land within about 200 m of where they are; Clapham Junction too.
- The file stays small: say what it adds gzipped (the places file is 123 KB now).
- Credit for the data source wherever the points show (as for RTT, Network Rail and OpenStreetMap now).

## Not this
The map layer and the card (`find-on-map`). Track geometry.

## Log
- 2026-10-25 shaped by the Director from the producer's /director. Start with a spike: can the deploy reach a BPLAN download without an account, and how many of the 12,000 places does it place?
