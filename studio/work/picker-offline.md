---
title: The map picker works without asking OpenStreetMap's servers
kind: build
role: engineer
size: M
status: shaped
needs: [places, one-point]
---

## Why
#21, the producer, 2026-10-24: "The map view has never worked for me. Always errors": every time, "OpenStreetMap is busy/slow". Each tap asks a public Overpass server, which is often overloaded (40 s, 502s, 215 s in our probes).

## Done when
- A tap finds the track from the map's own vector tiles (OpenFreeMap's `transportation` layer, `class=rail`), already downloaded to show the map, and the stations from the tiles' station points matched by name to the `places` list for their codes. No Overpass request in the usual case.
- Tapping a station picks that one point (`one-point`); tapping the track between two picks them both, as now.
- Overpass stays only as a fallback where the tiles have no rail, and says plainly when it's busy.
- Tried on the producer's phone at their bridge, and by the Tester at three places (Brookwood–Woking, Clapham Junction, a rural line).

## Not this
Our own tile server or a bundled track map of Britain.

## Log
- 2026-10-24 shaped by the Director from #21. Start with a spike: does OpenFreeMap's `liberty` style carry rail lines and station names at zoom 14 to 16 around Woking?
