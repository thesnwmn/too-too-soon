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

Or a single point: a station or junction you watch from (a platform, or a bridge right by one). Its link has no `b` and no `f` (`?name=Woking&a=WOK&an=Woking`), and the page lists every train at that point: when it's there (as it leaves, or passes, or arrives where it ends), heading for its destination, and whether it stops (`predictAt` in `packages/core`, from one line-up). The set-up form asks "One place" or "Between two"; a new spot starts with one place, and its name defaults to the place's.

The phone remembers the last five spots watched, newest first (`web/src/recent.ts`, in localStorage as each spot's link query). The set-up form lists them under "Your spots": a tap watches one again, ✕ forgets it. Watching a spot again moves it to the top rather than adding a copy (the same `a`, `b` and `f`, under its newest name). Opening the page with no spot in the link shows the newest. The demo's spot is never remembered.

Ways to set it up:

- **On a map** ("Pick on a map"): zoom in and tap the track. The page asks OpenStreetMap's Overpass API (through the Worker) for the running lines (not sidings, yards or crossovers) and the nodes tagged `ref:tiploc`, plus stations tagged `ref:crs` (TIPLOCs are patchy in OSM: there are none for miles around Woking, but stations nearly always have their CRS code, which RTT also takes), within 3 km (then 8 km if that finds nothing), snaps the tap onto the nearest track, and walks the track both ways to the nearest timing point on each side. A station mapped beside the rails counts if it's within 250 m of a track, on every track that close (double track is two lines in OSM, and either may be tapped), and only on the side of the tap it lies on, so a walk round a crossover can't find the other side's station. A and B are labelled on the map, and the set-up form can swap them. The copy button copies where you last tapped ("lat, lon"), to send a place to someone (or the studio). `f` is the distance along the track to A over the distance from A to B. The walk follows the track, so a station on another line nearby is never picked; at a junction it takes the nearest timing point down any branch, so check the two names it shows. (`locate` in `packages/core`, with tests on a made-up stretch.)
- **By name**: type a few letters of A and B ("wok") and pick from what's offered: stations first (by their three-letter code, like WOK), then junctions, yards and other timing points (by TIPLOC, like WOKINGJ), each word typed matching the start of a word in the name ("clap junc"; RTT's "Jn" counts as "junction"). Picking fills in the code and the name. A name typed in full, or a code, works without picking; anything else asks you to pick. Then slide `f`. The list is RTT's own (`/data/stops` and `/data/locations_ungrouped`), made small at deploy time by `.github/scripts/places.mjs` (a few thousand stations and about ten thousand other timing points, a few hundred KB; `code/places` checks its shape and size, and so does the script before writing it) and searched in the page, fetched once the first time a search box is used. Where there's no list (the demo on Pages), it asks for codes. (`compactPlaces` and `searchPlaces` in `packages/core`.)

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
