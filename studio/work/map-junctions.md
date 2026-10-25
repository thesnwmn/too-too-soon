---
title: Junctions and other timing points on the map, from Network Rail's list
kind: build
role: engineer
size: S
status: done
pr: 30
milestone: m1-first-trains
needs: [junction-points]
---

## Why
`point-coords` placed the stations from NaPTAN; junctions, yards and signals aren't in it. Network Rail's BPLAN has every timing point with an easting and northing, but needs a free Network Rail Open Data account, so the producer downloads it once and the studio keeps a copy.

## Done when
- A script reads the producer's BPLAN file (`Geography_*.txt`, gzipped or not) and writes a kept copy, `packages/core/data/bplan-points.json`: [TIPLOC, lat, lon] for each timing point with a place, eastings and northings (OSGB36) converted to latitude and longitude. It says which BPLAN it came from.
- The deploy adds them to `points.json` for the place list's timing points, and for stations NaPTAN missed; NaPTAN wins for a station.
- Spot checks: Woking Junction within 200 m of where it is; Woking from BPLAN within 150 m of Woking from NaPTAN (BPLAN rounds to 100 m).
- A health check on the kept copy (shape, size, all in Great Britain), with broken fixtures; a warning once it's over two years old.
- Credit for Network Rail's data wherever the points show: in find-on-map's Done when.

## Not this
Track geometry from BPLAN's network links (NWK); drawing anything.

## Log
- 2026-10-25 an idea from `point-coords`: the deploy fetches BPLAN with the account's login in GitHub's secrets.
- 2026-10-25 the producer would rather no login were stored: download once, keep a copy. A script cuts the producer's BPLAN file down to [TIPLOC, lat, lon] for the timing points in the place list (eastings and northings, OSGB36, converted at that point), committed under `data/` with its date and the Open Government Licence credit; the deploy joins it into `points.json` after NaPTAN's stations, NaPTAN winning for stations. A health check on the kept file (shape, size, all in Great Britain, how old). Spot check: Woking Junction within 200 m. Refreshed by hand, every year or so.
- 2026-10-25 built (#30) from the BPLAN the producer sent (2 June to 14 December 2024): 6,164 of its 11,886 locations kept with a place (`packages/core/data/bplan-points.json`, 176 KB; placeholders 0, 1, 666666 and 999999, and 138 outside Great Britain, left out). The grid references convert to within a metre of NaPTAN's own. But BPLAN's are often wrong for small points (Barnes Signal W1090 700 km from Barnes), so the deploy keeps one only within 5 km of the station it's named after, else 15 km of any station; the producer asked, "Is 15km a good level of precision?", and the 2024 file showed a break at 5 km (1,452 of the named points within 5 km, 23 more by 15 km, the rest mostly hundreds of km out). A real run: 2,611 stations and 3,064 other timing points placed, 487 BPLAN points left out, `points.json` 153 KB (62 KB gzipped); Woking Jn at 51.31113, -0.56217. **When a point is missing from the map, the 5 km and 15 km cut-offs are the first suspect** (the producer asked for this to be noted): the deploy's log lists every point left out, and `docs/how-it-works.md` ("If a point is missing from the map") has the list of causes. [Session](../sessions/2026-10-25-0742-map-junctions.md).
- 2026-10-25 review and the producer's "Is the site going to need to download this file? … can we reduce its size?": the page never downloads the kept copy (only the deploy reads it); it will download `points.json` when the map opens, now packed (columns, steps of ten-thousandths of a degree): 76 KB, 39 KB gzipped, from 153 KB and 62 KB. Many of the 487 left out are BPLAN's Irish locations (Dublin, Cork, Galway), rightly. find-on-map keeps it on the phone. Critic: the Woking spot check was 113 m, not under 100 m (BPLAN's rounding, so the claim is now 150 m, with a test against NaPTAN); find-on-map's Done when now credits Network Rail; a name two stations share is near either; a BPLAN record ending after the file starts is kept.
