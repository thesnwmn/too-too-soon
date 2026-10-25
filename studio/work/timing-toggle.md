---
title: The map shows stations only, with a switch for the other timing points
kind: build
role: engineer
size: S
status: doing
milestone: m1-first-trains
---

## Why
The producer, 2026-10-25, via /director, after trying Find on map: "the timing points other than stations are terribly placed on the map. We should allow them to be toggled on and off (off by default)." The stations come from NaPTAN and are where they are; the junctions and other timing points come from BPLAN, whose grid references are often rounded to 100 m or simply wrong (`map-junctions`).

## Done when
- The map (Find on map and Pick on a map) opens showing stations only.
- A switch on the map, "Junctions and timing points", turns the others on and off; they're marked as approximate when on (in the card: "Place approximate (Network Rail's grid reference)").
- The switch is off every time the map opens, unless turned on: then it's remembered on this phone (localStorage, as the recent spots are), so someone who wants them doesn't have to turn it on each time.
- Clusters and their counts follow the switch (a cluster of hidden points doesn't show).
- The Network Rail credit shows only while the other timing points are on.
- Fits one screen with no scroll at 390×844, 375×667 and 360×640 with the switch; checked by the Tester.

## Not this
Moving the points to better places (a better source than BPLAN, or snapping them to the track); the place list's search, which still offers junctions by name.

## Log
- 2026-10-25 shaped by the Director from the producer's /director. Defaults the producer can change: the switch's name, and remembering it once turned on.
