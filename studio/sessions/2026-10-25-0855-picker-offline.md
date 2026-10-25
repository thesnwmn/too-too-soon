---
date: 2026-10-25
command: /go map picker offline
units: [picker-offline]
pr: 35
session: https://claude.ai/code/session_01Fq4zbkYjdJUFQk2wErjM3m
health: green at start and end
size: M
---

## Summary
A tap on the track in Pick on a map now works from the map's own OpenFreeMap tiles and our dots, with no Overpass request: the picker decodes the tiles' rail lines, joins them across tile edges, walks to the nearest dot each way and fetches more tiles along the line when it needs to. Overpass is only the fallback where the tiles have no rail near the tap. On trial.

## The producer said
- `/go map picker offline`; and before, in #21: "The map view has never worked for me. Always errors."

## Done
- `packages/core/src/tiles.ts`: tile maths, `tracksFromLines` (tiles' lines into joined ways), `dotNodes`, `tilesAhead` (the tiles past each cut end), `fromTrack`; tests.
- `packages/core/src/locate.ts`: a station isn't hung off a segment's end when a segment from that end comes nearer it (it was measured short), nor off a cut end.
- `web/src/track.ts`: fetch and decode tiles (`@mapbox/vector-tile`, `pbf`, already in MapLibre's tree), and the fetch-and-walk loop; tests on encoded tiles. `web/src/picker.ts` uses it, with Overpass as the fallback.
- `code/map-lazy` also keeps the tile decoder in the picker's chunk; tests.
- `docs/how-it-works.md`, `docs/architecture.md`, `studio/README.md`.

- Critic: a branch's station beat a nearer one just past a tile's edge; fixed (`tilesAhead` measures along the track to the nearest cut, and the walk waits for those tiles). Tester: a tap just off the track asked OpenStreetMap; it now says it missed.

## Tried and dropped
- Joining a tile's cut end with a short connector line: it hid the next tile's segment from the station's nearest-point test. Moving the end onto the line it joins does it.

## Learned
- The old `locate` could measure a station a little short whenever a segment ended near it; tiles' cut lines made that common.
- Sessions still can't reach the tile servers, so whether OpenFreeMap's zoom 14 tiles carry every running line with `class=rail` is for the trial.

## Left for next time
- `picker-near-lines` (idea, from the Tester): a station within 250 m of another line is hung off it too.
- The trial at the bridge: real tiles, the time a tap takes with a weak signal.
- A default the producer can change: the track tap finds only the dots that show (stations, or junctions too with the switch on).
