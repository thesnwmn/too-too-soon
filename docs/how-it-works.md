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

For now A, B and `f` are typed in. The map picker (a unit on the board) will find them: tap near the bridge, snap to the railway in OpenStreetMap, walk the line to the nearest nodes tagged `ref:tiploc` each way, and measure `f` along the track.

## Getting the trains

Every refresh, the Worker makes two calls to Realtime Trains, each from 15 minutes ago to about 90 minutes ahead, in detailed mode (which includes trains that pass without stopping):

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

Each pass also carries what it is (a passenger train with origin, destination and coaches, or freight or empty stock), whether it stops at A or B, and how sure the time is: **actual** once it has really passed the first point, **forecast** with live data, **timetable** without.

Linear is close at line speed. A train that stops at A reaches the bridge a little later than linear says (it's still accelerating), and one stopping at B a little earlier. Expect ±1 to 2 minutes; the "it's here!" idea on the board learns each spot's offsets to close the gap.

## Edge cases

- **A train at only one end** (it starts or ends in between, at a depot or siding): left out.
- **Around midnight**: the join uses the unique identity, which includes the date.
- **No live data** (`systemStatus` says `REALTIME_DATA_LIMITED` or `SCHEDULE_ONLY`): timetable times, marked as such.
- **Engineering works**: diverted trains show as `DIVERTED` and are dropped.
