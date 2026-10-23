# Too Too Soon

> "Too too" is what Justin's son calls trains. This site answers one question, "how long till the next too too?", and the answer is the name: too too soon!

A small web site for one job: **pick a spot on the railway (say, a bridge you like to watch from) and get a list of the next trains that should pass it, with a countdown.** It's for taking a child to watch trains without standing around for 25 minutes, or arriving just as one goes by.

Scope: Great Britain (Network Rail). Browser first, works on a phone. Free to run for one family.

## How it works

A bridge sits between two **timing points** (stations or junctions, each with a TIPLOC code) that have timetable entries. Every train that passes the bridge passes both. The Realtime Trains API lists every train at a timing point, including ones that don't stop and freight, with live times. So the site asks for the trains at both, keeps the ones at both, and works out when each reaches the bridge from how far along the track it is. More in [how it works](docs/how-it-works.md) and [architecture](docs/architecture.md).

```
 Every minute or so:  trains at A  +  trains at B   (Realtime Trains API, via our Worker)
        │   keep only trains that appear at both = trains that pass the bridge
        ▼
 Pass time ≈ time at A + 40% × (time at B − time at A)
        ▼
 "Next trains":  ⬅ 14:07 (in 3 min) London-bound, non-stop, 9-car
                 ➡ 14:12 (in 8 min) freight, 6 min late
```

## Where it is

Being built. Once the [one-time setup](studio/producer-guide.md#one-time-setup) is done, every merge to `main` deploys it to Cloudflare's free plan.

## Developing

```
pnpm install
pnpm health        # is the repo ready to work on?
pnpm board         # what's next
```

It's built by a team of agents with one human producer: see [the studio](studio/README.md). Research behind it: [thesnwmn/notes](https://github.com/thesnwmn/notes/tree/main/too-too-soon).

## Credits

Train data from [Realtime Trains](https://www.realtimetrains.co.uk/) and Network Rail. Map data © OpenStreetMap contributors.
