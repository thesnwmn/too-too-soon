# How it works

How a dot on a map becomes "next train in 4 minutes, heading towards London". From the research in [the notes](https://github.com/thesnwmn/notes/blob/main/too-too-soon/02-predicting-passes.md).

## Bracket the spot with two timing points

Trains report, and are timetabled, at **timing points**: stations, junctions and some other named places, each with a TIPLOC code (e.g. `CLPHMJN`). A bridge won't be one, but it sits on the track between two of them:

```
   A (timing point)            🌉 bridge                B (timing point)
   ●────────────────────────────┼────────────────────────●
   |<──────── f = 40% of the track distance ──>|
```

If A and B are **adjacent** timing points on the same line (no junction between), every train that passes the bridge appears at both, and every train at both passes the bridge.

## Setting up a spot

Done once. A spot is a small object, kept in the URL (so it can be bookmarked) and on the phone:

```
{ name: "Our bridge", a: "XXXXXXX", b: "YYYYYYY", f: 0.4, aName: "…", bName: "…" }
```

Or a single point: a station or junction you watch from (a platform, or a bridge right by one). Its link has no `b` and no `f` (`?name=Woking&a=WOK&an=Woking`), and the page lists every train at that point: when it's there (as it leaves, or passes, or arrives where it ends), heading for its destination, and whether it stops (`predictAt` in `packages/core`, from one line-up). The set-up form asks "One place" or "Between two"; a new spot starts with one place.

The Name box fills itself in as the places are picked (`autoName` in `web/src/fill.ts`), and keeps up as the places, One place / Between two, Swap or the slider change, until you type a name of your own, which is never written over; emptying the box hands it back to the made-up name when you leave it. One place: the place's name. Between two, from a tap on the track: the road or path crossing the line nearest the spot on the line, within 150 m of it, from the same tiles (`transportation_name`, with "bridge" added where it or a `brunnel=bridge` line in `transportation` goes over the track there: "Hermitage Road bridge"); it gives way to "Between A and B" once A, B or the slider move off the tap, and when no named road crosses near enough. Picked by name: "Between A and B". A saved spot keeps its own name (`nameAtTrack` in `packages/core/src/naming.ts`, `nameOnTiles` in `web/src/track.ts`).

The phone remembers the last five spots watched, newest first (`web/src/recent.ts`, in localStorage as each spot's link query). The set-up form lists them under "Your spots": a tap watches one again, ✕ forgets it. Watching a spot again moves it to the top rather than adding a copy (the same `a`, `b` and `f`, under its newest name). Opening the page with no spot in the link shows the newest. The demo's spot is never remembered.

Ways to set it up:

- **On a map** ("Pick on a map"): zoom in and tap the track. The page finds the track in the map's own vector tiles, the ones OpenFreeMap sends to draw the map (so those in view are already on the phone): the `transportation` layer's running lines (`class=rail`, not sidings, yards, spurs or crossovers), from the zoom 14 tiles within about 1.5 km of the tap (`web/src/track.ts`). The timing points are the dots on the map (`points.json`): the stations, and the junctions and other timing points too while their switch is on, so the two it picks are dots you can see. A tile's lines stop a little past its edge, where the next tile's carry on: a line's loose end within 3 m of another line is joined onto it, and a station just past where a tile's line stops is measured along the next tile's (`tracksFromLines`). It snaps the tap onto the nearest track and walks it both ways to the nearest timing point on each side; when the walk runs off the edge of the tiles it has, it fetches the tiles just past each cut end (`tilesAhead`) and walks again; it does the same when what it found is further along the track than a cut end, as a nearer one may be past it (a station down a branch mustn't beat the main line's, just past a tile's edge); up to 40 tiles (about 9 km of line each way). No server is asked per tap but the tile server, which is a CDN. A tap more than 200 m from the tiles' nearest running line (but within a kilometre) is a miss: it says to tap right on the line. Where the tiles have no running line within a kilometre of the tap (or there are no dots: no signal, first time), it asks OpenStreetMap's Overpass API instead, as it used to: through the Worker, for the running lines and the nodes tagged `ref:tiploc`, plus stations tagged `ref:crs` (TIPLOCs are patchy in OSM: there are none for miles around Woking, but stations nearly always have their CRS code, which RTT also takes), within 3 km (then 8 km if that finds nothing); and says plainly when it's busy. It doesn't fall back when the tiles have track but no dot each way within those 40 tiles (a long rural stretch with the junctions switched off: switch them on, or tap a dot), or when the tile server itself fails (it says so: try again). A station mapped beside the rails counts if it's within 250 m of a track, on every track that close (double track is two lines in OSM, and either may be tapped), and only on the side of the tap it lies on, so a walk round a crossover can't find the other side's station. A and B are labelled on the map, and the set-up form can swap them. The copy button copies where you last tapped ("lat, lon"), to send a place to someone (or the studio). `f` is the distance along the track to A over the distance from A to B. The walk follows the track, so a station on another line nearby is never picked; at a junction it takes the nearest timing point down any branch, so check the two names it shows. A station is hung off a segment's end only where no segment from that end comes nearer it, so it's measured from where it really is along the track. (`locate` in `packages/core`, with tests on a made-up stretch, and `tracksFromLines` and `tilesAhead` in `packages/core/src/tiles.ts`, with tests on tiles made up the way OpenMapTiles writes them.)
- **Find on map**: each place box has a "Find on map" button, and "Pick on a map" shows the same: every station that `points.json` places, as a green dot (gathered with a count when zoomed out, named when zoomed in), drawn from the file with no request per tap. A switch on the map, "Junctions and timing points", adds the rest (orange junctions and grey other timing points, gathered apart from the stations): off by default, as BPLAN places them badly, and remembered on the phone once turned on (`web/src/toggle.ts`); their cards say the place is approximate, and Network Rail's credit shows only while they do. A box, or the spot being watched, already holding one of them turns them on for that visit. A tap on a dot opens a card (its name, kind, and CRS or TIPLOC); "Use this" fills that box, or from "Pick on a map", "Use as the one place", "Use as A" or "Use as B" fills it and sets One place or Between two to match (with two, slide `f` yourself). The map opens on the other box's place, so B is found near A, else the box's own, else the spot being watched, else near you if the phone has already allowed it, else Great Britain (`mapCentre`). The dots' names and kinds come from the place list, joined by code (`mapPoints`); a point it doesn't name isn't drawn. `points.json` is fetched only when the map opens; it and `places.json` are kept on the phone with the Cache API, so the dots show, named, with a weak signal: a kept copy is used at once and a fresh one fetched behind it for next time (`web/src/kept.ts`). The map's credits: the Open Government Licence statements for NaPTAN and Network Rail, and Realtime Trains for the names. On a phone they start open and fold into an ⓘ (tap it to read them) at your first tap, zoom or move, so they don't cover the map. On Pick on a map, a tap within 8 px of a dot opens its card (16 px on Find on map), so a tap on the track beside one is still a track tap. The demo on Pages has a small real sample around Woking (`web/demo/`).
- **By name**: type a few letters of A and B ("wok") and pick from what's offered: stations first (by their three-letter code, like WOK), then junctions, yards and other timing points (by TIPLOC, like WOKINGJ), each word typed matching the start of a word in the name ("clap junc"; RTT's "Jn" counts as "junction"). Picking fills in the code and the name. A name typed in full, or a code, works without picking; anything else asks you to pick. Then slide `f`. The list is RTT's own (`/data/stops` and `/data/locations_ungrouped`), made small at deploy time by `.github/scripts/places.mjs` (a few thousand stations and about ten thousand other timing points, a few hundred KB; `code/places` checks its shape and size, and so does the script before writing it) and searched in the page, fetched once the first time a search box is used. Where there's no list (a deploy that couldn't ask RTT), it asks for codes. The demo on Pages has a small sample instead (`web/demo/`): its search offers only those 14 places around Woking, and a code typed in capitals still works. (`compactPlaces` and `searchPlaces` in `packages/core`.)
- **Where they are**: beside the place list, the deploy writes `points.json`, where each station and timing point is, keyed by the code the place list uses. It's packed for the page: in columns (the codes, then the latitudes, then the longitudes), sorted south to north, each place in ten-thousandths of a degree (about 10 m) as a step from the one before, which halves it (76 KB, 39 KB gzipped, for 5,675 points, against 153 KB and 62 KB unpacked); `unpackPoints` reads it back. The page fetches it only when the map opens. RTT's lists have no coordinates, so they come from NaPTAN, the Department for Transport's open list of stops (rail stations are `9100<TIPLOC>`; Open Government Licence), joined to RTT's station by TIPLOC and, where NaPTAN's TIPLOC isn't RTT's (Clapham Junction), by a name only one station has (in RTT's list, and in NaPTAN's within a kilometre, so two Newports never trade places). Junctions and other timing points aren't in NaPTAN; Network Rail's own list (BPLAN, Open Government Licence) has them, with OS grid references, but needs an account to download. So the producer downloads one now and then, `pnpm bplan <Geography_….txt.gz>` keeps a small copy in `packages/core/data/bplan-points.json` (TIPLOC, latitude, longitude: the grid references converted from OSGB36 by `osgbToLatLon`, which agrees with NaPTAN's own conversions to a metre, though BPLAN's grid references themselves are coarser, most to 100 m, so a place can be 100 to 150 m out; BPLAN's placeholders, anything outside Great Britain and anything ended before the file starts left out), and the deploy adds them for the place list's timing points. BPLAN's grid references are often wrong for small points (Barnes Signal W1090 is 700 km from Barnes), so a BPLAN point is kept only if it's within 5 km of the station it's named after (Woking Jn by Woking), else within 15 km of any station (where two stations share the name, near either will do); that catches gross errors only, and BPLAN rounds most to 100 m. `code/bplan` checks the kept copy, and warns when it's two years past its end. `code/points` checks the file (packed, at least a thousand, all in Great Britain, under 250 KB), and so does the script; if NaPTAN or RTT doesn't answer, there's no file. Find on map draws it. (`naptanStations` and `compactPoints` in `packages/core`, and `bplanPoints` for BPLAN.)
- **If a point is missing from the map**, it's one of these, most likely first:
  1. **The 5 km and 15 km cut-offs** (`NAMESAKE_KM`, `ANY_STATION_KM` in `packages/core/src/points.ts`). A BPLAN point more than 5 km from the station whose name starts its own, or (named after no station) more than 15 km from every station, is left out as a likely bad grid reference. A real junction a long way from the town it's named after, or a point on a remote line, can be lost this way. The deploy's log lists every point left out ("left out N BPLAN points …"); the probe's `places` mode shows the same.
  2. **BPLAN has no grid reference for it** (0, 1, 666666, 999999), or puts it outside Great Britain: not in the kept copy at all (`packages/core/data/bplan-points.json`).
  3. **It isn't in the place list** (`places.json`): RTT doesn't list it, or it's a big station's platform, which the station stands for.
  4. **A station NaPTAN doesn't have**: it falls back to BPLAN, and so to 1 and 2.

After this the site never needs OpenStreetMap again for that spot: refreshes only ask the Worker.

## Getting the trains

Every refresh, the Worker makes two calls to Realtime Trains (and, with an allocations entitlement, one more per train it hasn't yet asked about, for the class of train: see [architecture](architecture.md#rate-limits)), each from 15 minutes ago to about 90 minutes ahead, in detailed mode (which includes trains that pass without stopping):

```
GET /gb-nr/location?code=A&timeFrom=…&timeWindow=…&detailed=true
GET /gb-nr/location?code=B&timeFrom=…&timeWindow=…&detailed=true
```

It joins them on each service's `uniqueIdentity` (identity and departure date, so the same train number on two days never matches). A train in both lists is a bridge train; its direction is whichever of A and B it reaches first. Trains shown as `CANCELLED` or `DIVERTED` at either end are dropped.

## The time sum

For each train, the best known time at A and at B:

```
best(x)   = realtimeActual ?? realtimeForecast ?? realtimeEstimate ?? scheduleInternal ?? scheduleAdvertised
time at A = best(departure at A) or best(pass at A)     (heading A → B)
time at B = best(arrival at B)   or best(pass at B)
pass      = tA + f × (tB − tA)
```

An estimate (RTT's guess for a train that hasn't reported) counts as a forecast. When there's a live time at the first point but only the timetable at the second, the lateness at the first is carried over to the second, so a late train isn't interpolated towards an on-time arrival. Lateness is worked out from the times (RTT's own lateness figure is only there once a train has really passed).

Each pass also carries what it is (a passenger train with origin, destination and coaches, or freight or empty stock), whether it stops at A or B, and how sure the time is: **actual** once it has really passed the first point, **forecast** with live data, **timetable** without.

Linear is close at line speed. A train that stops at A reaches the bridge a little later than linear says (it's still accelerating), and one stopping at B a little earlier. Expect ±1 to 2 minutes; the "it's here!" idea on the board learns each spot's offsets to close the gap.

## Edge cases

- **A train at only one end** (it starts or ends in between, at a depot or siding): left out.
- **Around midnight**: the join uses the unique identity, which includes the date.
- **No live data** (`systemStatus` says anything but `OK`, like `REALTIME_DATA_LIMITED` or `SCHEDULE_ONLY`): timetable times, marked as such.
- **Engineering works**: diverted trains show as `DIVERTED` and are dropped. Replacement buses listed at a station are dropped too.
- **Cancelled calls**: a train shown as `CANCELLED` at A or B is dropped. RTT doesn't say whether that means "won't stop" or "won't run", so a few trains that do pass are missed: the safer mistake at a bridge.
- **The clocks changing**: the live API sends UK wall-clock times without an offset, so they're read as UK time (summer time included); a time with an offset is read as given. The one ambiguous hour when the clocks go back is read as its first, summer-time pass.
