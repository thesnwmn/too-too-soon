# Too Too Soon

> "Too too" is what Justin's son calls trains. This site answers one question, "how long till the next too too?", and the answer is the name: too too soon!

A small web site for one job: **pick a spot on the railway (say, a bridge you like to watch from) and get a list of the next trains that should pass it, with a countdown.** It's for taking a child to watch trains without standing around for 25 minutes, or arriving just as one goes by.

Today that means opening a live map such as Signalbox, clicking trains one at a time, reading their station times and working out in your head when each reaches the bridge. Too Too Soon does that sum for every train at once.

Scope: Great Britain (Network Rail). Browser first, works on a phone. Free or nearly free to run for one family.

## How it works

A bridge almost never has its own timetable entry, but it nearly always sits between two **timing points** (stations, junctions or other named locations, each with a TIPLOC code) that do. Every train that passes the bridge also passes both. The Realtime Trains API lists every train at a timing point, including ones that don't stop and freight, with scheduled, forecast and actual times.

```
 You pick a spot on a map
        │
        ▼
 Snap to the railway line, find the timing point either side (A and B)
 and how far along the track from A to B the spot is  (e.g. 40%)
        │   saved once as the "spot": A, B, 0.40, plus any offsets
        ▼
 Every minute or so:  trains at A  +  trains at B   (Realtime Trains API)
        │   keep only trains that appear at both = trains that pass the bridge
        ▼
 Pass time ≈ time at A + 40% × (time at B − time at A)
        │   pick the best known time: actual > forecast > scheduled
        ▼
 "Next trains":  ⬅ 14:07 (in 3 min) London-bound, non-stop, 9-car
                 ➡ 14:12 (in 8 min) freight, 6 min late
```

## Planned stack

| Concern | Pick |
|---|---|
| Live train data | Realtime Trains API (`data.rtt.io`) |
| Map and picking a spot | MapLibre GL JS + OpenFreeMap tiles + OpenRailwayMap overlay |
| Finding timing points | OpenStreetMap nodes tagged `ref:tiploc`, via Overpass |
| Front end | One static page (TypeScript + Vite), installable as a PWA |
| Back end | One Cloudflare Worker: holds the API token, merges A and B, caches for 60 s |
| Hosting | Cloudflare Pages |

The API token lives only in the Worker's secrets, never in this repo, the page or a URL.

## Roadmap

0. **Prove the data.** Confirm Realtime Trains' detailed mode returns passing trains for the timing points either side of a real bridge, and compare with what actually goes past.
1. **One bridge, hard-coded.** Worker + a single page with a live countdown list.
2. **Any spot.** Map picker, timing-point lookup, spots saved in the URL and `localStorage`, an "it's here!" button that learns offsets.
3. **Nicer for a child.** Logo and home-screen icon, train types and pictures, "trains seen today" stats.
4. **Optional: "it's coming now" alerts** from Network Rail's signalling (TD) feed on a small always-on box.

## Research

The background research (data sources, prediction method, architecture, hosting and existing tools) lives in [thesnwmn/notes](https://github.com/thesnwmn/notes/tree/main/too-too-soon).

## Credits

Train data from Realtime Trains and Network Rail. Map data © OpenStreetMap contributors.
