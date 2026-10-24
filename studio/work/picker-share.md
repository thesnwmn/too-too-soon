---
title: The picker shows where you tapped, and a spot can be shared
kind: build
role: engineer
status: idea
---

## Why
The producer, 2026-10-23: "Be nice if the picker showed the coordinates so I could get them from there." Google Maps swapped copied coordinates for a postcode, so there was no easy way to send the studio a place. Show the tapped coordinates (copyable) in the picker, especially when it finds nothing, and a "Share this spot" button on the watch view that copies its link.

## Log
- 2026-10-23 the coordinates half done (#11): every tap shows "You tapped lat, lon" with a Copy button. The "Share this spot" button is still to do.
- 2026-10-24 the producer: the picker scrolled slightly, and "Failed to fetch". Now one screen with no scroll (checked at 390×844, 375×667, 360×640), the copy is an icon button beside Near me and Use this spot (disabled until a tap), and the OpenStreetMap lookup goes through the Worker's `/api/osm` (#15).
- 2026-10-24 "OpenStreetMap is slow to answer" at the producer's bridge: Overpass took 40 s, then (late at night) 502 and 215 s. Now a bounding box instead of (around:), tracks as skeletons, three servers with 25 s each in the Worker, and the page waits 80 s and says it's still looking (#16). The probe found the bridge: BKO to WOK, f 0.52.
