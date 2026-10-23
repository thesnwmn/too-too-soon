---
title: Pick the spot on a map
kind: build
role: engineer
size: M
status: shaped
milestone: m1-first-trains
needs: [watch-page]
---

## Why
Typing TIPLOC codes is a chore; tapping the bridge on a map is how anyone would want to set it up ([how it works](../../docs/how-it-works.md#setting-up-a-spot)).

## Done when
- A set-up screen with MapLibre, OpenFreeMap tiles and the OpenRailwayMap overlay; tap near the bridge.
- One Overpass query finds the railway line and the nearest `ref:tiploc` nodes either side, and the fraction along the track (Turf.js).
- A and B are shown on the map and can be swapped or typed instead; direction labels default to A's and B's names.
- Saving gives the watch view's URL. Credits for OSM and OpenRailwayMap are shown.

## Not this
Checking A and B are adjacent timing points (a warning later, from the data).

## Log
