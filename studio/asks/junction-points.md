---
title: Junctions on the map need Network Rail's list. Set up a free account for it?
from: engineer
status: open
blocks: [map-junctions]
default: Stations only on the map. Junctions and other timing points are still found by name in the search.
expires: after 3 sessions
gated: true                 # an account only the producer can open
---

The map will show every station (from NaPTAN, the government's open list of stops, no account needed). Junctions, yards and signals aren't in it. Network Rail's own list of timing points (BPLAN) has them all, with where they are, but it's only downloadable with a free Network Rail Open Data account, and the Open Rail Data wiki that links to it turns GitHub's servers away.

Options:
- **Stations only** (recommended for now): nothing to do. For a bridge between two stations, as yours is (Brookwood and Woking), that's all you need.
- **Open a free account** at publicdatafeeds.networkrail.co.uk, then put its email and password in this repo's GitHub secrets as `NROD_EMAIL` and `NROD_PASSWORD`. The deploy then adds the junctions. Worth it if you watch near a junction.
