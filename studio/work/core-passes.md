---
title: Predict pass times from two timing points
kind: build
role: engineer
size: M
status: done
milestone: m1-first-trains
pr: 2
---

## Why
The heart of it ([how it works](../../docs/how-it-works.md)): join the trains listed at timing points A and B, and estimate when each reaches the spot between them.

## Done when
- `packages/core` reads RTT `/gb-nr/location` responses (types from the [API spec](https://github.com/realtimetrains/api-specification)), joins A and B on unique identity, works out direction, and gives each train a predicted pass time from the best known times (actual > forecast > estimate > schedule) and the fraction `f`.
- Cancelled and diverted trains are dropped; trains that only appear at one end are left out.
- Each pass says what the time is based on (actual, forecast, timetable), whether the train stops at A or B, and what it is (passenger with origin and destination and coaches, or freight / empty stock).
- Tests over recorded-shape fixtures cover both directions, a late train, a cancellation, a train at only one end, and the midnight case.

## Not this
Fetching (the Worker's job), learned offsets (`its-here`).

## Log
- 2026-10-23 started, #2. Also holds the spot URL format and the `/api/next` response types (`spot.ts`, `api.ts`), so the Worker and page share them from the start.
- 2026-10-23 review: the Critic found lateness read from a field RTT leaves empty until a train has passed, and a late train at A interpolated towards an on-time B. Both fixed, with spec-shaped tests (midnight, the clocks changing, replacement buses); `code/no-dom` now also forbids fetch in core.
- 2026-10-23 done, #2.
