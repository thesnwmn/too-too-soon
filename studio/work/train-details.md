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
- Each train in the list says what it is and whether it stops near here, naming the station ("stopping at Woking", "fast: not stopping"); a tap on it says who runs it, where it's from (and, for freight, where it's going), which way, how late, and its headcode.
- Where RTT's allocations say it, the type of train ("Class 444"); a probe of the live data records what RTT really sends.
- The big card says the same, and the list stays one glance per train at 360 px: compact rows, a tap opens the rest (the producer, mid-build: "Can it be compact and expand/collapse on click?").
- Tests with recorded-shape fixtures; the token rule holds.

## Not this
A page per train, or unit numbers. Asking RTT about every train on every refresh: the class needs one lookup per train, so it's asked once for each of the next six passenger trains, kept for six hours, never holds the list up, and stops after a 429 (docs/architecture.md#rate-limits).

## Log
- 2026-10-24 shaped from the producer's word; started.
- 2026-10-24 the probe's new `sample` mode (RTT itself, at BKO): the line-up has no allocations, only `locationMetadata.allocationIndex`; `GET /gb-nr/service?uniqueIdentity=L79474:2026-10-24` (without "gb-nr:") has `allocationData` (1L69: `leadingClass` "159", units 159005 and 159003, one dropped en route as allocation 1). The token's entitlements: `allowDetailed`, `allowAllocationsPassenger`. Freight (3S84, 8Y82) has operator code ZZ and no name, from and to Effingham Jn. C.H.S.
