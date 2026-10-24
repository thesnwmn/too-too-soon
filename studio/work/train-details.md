---
title: More about each train, so you know what's coming
kind: build
role: engineer
size: M
status: doing
pr: 19
---

## Why
The producer, 2026-10-24, with detailed mode on: "Can we allow me to see a few more details on each entry? Help me know what train is coming." At a bridge with a child the question is "which one is it?": a South Western Railway Class 444 to Weymouth, or a GB Railfreight freight from Southampton.

## Done when
- Each train in the list says who runs it, where it's from and where it's going (freight too), and whether it stops near here in words naming the station ("stops at Woking", "fast, no stops").
- Where RTT's allocations say it, the type of train ("Class 444"); a probe of the live data records what RTT really sends.
- The big card says the same, and the list stays one glance per train at 360 px.
- Tests with recorded-shape fixtures; the token rule holds.

## Not this
A page per train, unit numbers, or asking RTT once per train.

## Log
- 2026-10-24 shaped from the producer's word; started.
