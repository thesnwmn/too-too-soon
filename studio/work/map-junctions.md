---
title: Junctions and other timing points on the map, from Network Rail's list
kind: build
role: engineer
status: idea
needs: [junction-points]
---

## Why
`point-coords` placed the stations from NaPTAN; junctions, yards and signals aren't in it. Network Rail's BPLAN has every timing point with an easting and northing, but needs a free Network Rail Open Data account, so the producer downloads it once and the studio keeps a copy.

## Log
- 2026-10-25 an idea from `point-coords`: the deploy fetches BPLAN with the account's login in GitHub's secrets.
- 2026-10-25 the producer would rather no login were stored: download once, keep a copy. A script cuts the producer's BPLAN file down to [TIPLOC, lat, lon] for the timing points in the place list (eastings and northings, OSGB36, converted at that point), committed under `data/` with its date and the Open Government Licence credit; the deploy joins it into `points.json` after NaPTAN's stations, NaPTAN winning for stations. A health check on the kept file (shape, size, all in Great Britain, how old). Spot check: Woking Junction within 200 m. Refreshed by hand, every year or so.
