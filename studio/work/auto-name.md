---
title: The spot's name fills itself in as you pick, from the place or the road at the tap
kind: build
role: engineer
size: M
status: trial
pr: 37
milestone: m1-first-trains
---

## Why
The producer, 2026-10-25, via /director: "add auto-name filling, using point name for one point and something sensible for between two points (or from the map selected spot if done that way)". Today the Name box stays empty while you set up: a name is only made up when you press Watch ("Between X and Y", or the place's own for one point), so you can't see it, and a spot picked on the map is named after its two timing points rather than where you actually stand.

## Done when
- The Name box fills in as soon as the places are picked (search, Find on map, or Pick on a map), and keeps up as they change (another place, One place / Between two, Swap), until you type a name of your own. What you type is never overwritten; clearing the box hands it back to the made-up name.
- One place: the place's name ("Woking").
- Between two, tapped on the map: the road or path that crosses the line nearest the tap, from the map's own vector tiles (OpenFreeMap's `transportation_name` / `transportation` layers, no extra request), as "<road> bridge" when it goes over the line (`brunnel=bridge`) and "<road>" otherwise. No named road within about 150 m of the spot on the line (the tap, snapped onto the track): "Between A and B".
- Between two, typed in: "Between A and B", as now.
- A recent spot or a shared link keeps the name it was saved with.
- Tests for the naming (one place, two, road found, road not found, a typed name kept) as pure functions with fixture features; checked at 390×844 by the Tester, including a map tap at Brookwood–Woking.

## Not this
Asking a geocoder or Overpass for the name; renaming saved spots; naming after landmarks other than roads and paths.

## Log
- 2026-10-25 shaped by the Director from the producer's /director, who chose filling the box as you pick and the road at the map tap (over "near X" or keeping "Between X and Y").
- 2026-10-25 built (#37, [session](../sessions/2026-10-25-1440-auto-name.md)): `autoName` in `web/src/fill.ts`, `nameAtTrack` in `packages/core/src/naming.ts`, `nameOnTiles` in `web/src/track.ts`. The road's name holds while the slider is nudged up to 5% (the Tester found a 1% nudge dropping it). Tester: every item holds at 390×844 and 360×640, the map tap on made-up tiles; OpenFreeMap's real tiles weren't reachable from here, so the tap at Brookwood–Woking is for the producer. On trial.
