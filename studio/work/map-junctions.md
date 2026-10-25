---
title: Junctions and other timing points on the map, from Network Rail's list
kind: build
role: engineer
status: idea
needs: [junction-points]
---

## Why
`point-coords` placed the stations from NaPTAN; junctions, yards and signals aren't in it. Network Rail's BPLAN has every timing point with an easting and northing, but needs a free Network Rail Open Data account.

## Log
- 2026-10-25 an idea from `point-coords`: with `NROD_EMAIL` and `NROD_PASSWORD` in the GitHub secrets, the deploy fetches BPLAN, converts eastings and northings (OSGB36) to latitude and longitude, and adds the timing points to `points.json`. Spot check: Woking Junction within 200 m.
