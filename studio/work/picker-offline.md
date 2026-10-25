---
title: The map picker works without asking OpenStreetMap's servers
kind: build
role: engineer
size: M
status: trial
pr: 35
milestone: m1-first-trains
needs: [places, one-point, find-on-map]
---

## Why
#21, the producer, 2026-10-24: "The map view has never worked for me. Always errors": every time, "OpenStreetMap is busy/slow". Each tap asks a public Overpass server, which is often overloaded (40 s, 502s, 215 s in our probes).

## Done when
- A tap on the track finds it from the map's own vector tiles (OpenFreeMap's `transportation` layer, `class=rail`, no sidings), the same tiles the map downloads to draw itself, fetching more along the line as the walk needs them, and the timing points from our own dots (`points.json`, which `find-on-map` already shows): the stations, and the other timing points too while their switch is on, so the two it picks are dots you can see. No Overpass request in the usual case.
- Tapping a dot picks that one point (`find-on-map` already does); tapping the track between two picks them both, as now.
- Overpass stays only as a fallback where the tiles have no rail, and says plainly when it's busy.
- Tried on the producer's phone at their bridge, and by the Tester at three places (Brookwood–Woking, Clapham Junction, a rural line).

## Not this
Our own tile server or a bundled track map of Britain.

## Log
- 2026-10-24 shaped by the Director from #21. Start with a spike: does OpenFreeMap's `liberty` style carry rail lines and station names at zoom 14 to 16 around Woking?
- 2026-10-25 `find-on-map` (the producer's /director) picks single points from our own file, with no Overpass. Once it lands, this unit is only the track tap for a spot between two: re-shape it then, perhaps as tapping between two dots.
- 2026-10-25 re-shaped by the Director on `/go map picker offline`: the timing points come from our dots rather than the tiles' station names (the dots already have codes and places, so no name matching), and the tap on a dot is done by `find-on-map`. Started, #35.
- 2026-10-25 built (#35). The track from the tiles' `transportation` rail lines (`web/src/track.ts`, decoded with `@mapbox/vector-tile`), joined across tile edges (`tracksFromLines`), fetched along the line as the walk runs off the edge (`tilesAhead`, up to 40 tiles); the timing points are the dots that show. Overpass only where the tiles have no rail within 1 km; a tap 200 m to 1 km off the track says it missed. `locate` no longer measures a station short when a segment stops near it. Critic: a branch's station could beat a nearer one just past a tile's edge (fixed: it waits for the tiles past a nearer cut, tested); smaller wording fixes. Tester, in Chromium on stand-in tiles cut as real ones are, 18 cases at 390×844: Woking–Brookwood (WOK/BKO, f 0.55, 0.5 s), the Portsmouth line, Clapham Jn–Earlsfield and –Wandsworth Town, Tisbury–Gillingham (25 tiles), Dalwhinnie–Blair Atholl (39 tiles); no Overpass or /api/osm request; the switch decides the junction dots; the fallback's 502 says busy; one screen, card included. Found, not this unit's: a station within 250 m of another line is hung off it too, so a Brighton-line tap near Clapham picked Queenstown Road (SWML), as Overpass did (`picker-near-lines`). Left for the trial: real OpenFreeMap tiles, and the producer's phone at the bridge. **A default the producer can change:** a track tap finds only the dots that show. [Session](../sessions/2026-10-25-0855-picker-offline.md).
