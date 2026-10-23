---
title: Pick the spot on a map
kind: build
role: engineer
size: M
status: trial
milestone: m1-first-trains
pr: 9
needs: [watch-page]
---

## Why
Typing TIPLOC codes is a chore; tapping the bridge on a map is how anyone would want to set it up ([how it works](../../docs/how-it-works.md#setting-up-a-spot)).

## Done when
- A set-up screen with MapLibre, OpenFreeMap tiles and the OpenRailwayMap overlay; tap near the bridge.
- One Overpass query finds the railway line and the nearest `ref:tiploc` nodes either side, and the fraction along the track (`locate` in core: hand-written geometry, so core stays dependency-free; Turf.js wasn't needed).
- A and B are shown on the map and can be swapped or typed instead; direction labels default to A's and B's names.
- Saving gives the watch view's URL. Credits for OSM and OpenRailwayMap are shown.

## Not this
Checking A and B are adjacent timing points (a warning later, from the data).

## Log
- 2026-10-23 started, #9. `locate` in core walks OSM's track graph from the tapped point to the nearest `ref:tiploc` either side; the picker (MapLibre, lazy-loaded) asks Overpass per tap.
- 2026-10-23 review: the Critic found double track broke it (stations hung off one line only), a halt partway along a long segment was skipped for the next station, and there was no swap. Fixed: stations attach to every track segment within 250 m at their projection, each side only takes stations on its side of the tap (so crossover loops can't cross over), sidings are left out of the query; tests for double track, crossovers, a mid-segment halt and a hairpin. Swap button, labelled A and B, credits always shown, `code/map-lazy` also catches re-exports.
- 2026-10-23 Tester (Chromium, stubbed tiles and Overpass): pick, fill, watch, no-track, Overpass 500 all held. Fixed what it found: MapLibre's web worker wasn't in the build (the real map would have been blank; now bundled by Vite and set with `setWorkerUrl`), Cancel lost what was typed, A and B were off screen (now fitted), Overpass had no timeout (30 s). Not checkable here: live tiles, real Overpass, "Near me"; try those on the phone.
- 2026-10-23 merged, #9: waiting for a try. Does tapping your bridge find the right two stations?
