---
title: The live site works at our bridge
kind: test
role: tester
size: S
status: shaped
milestone: m1-first-trains
needs: [deploy, one-time-setup, our-bridge]
---

## Why
The milestone's exit: real trains, real bridge.

## Done when
- `/api/info` on the live Worker says the token works and has detailed mode (passing trains). If it doesn't, an ask for the producer: the paid plan or the Network Rail route.
- The producer's spot is set up and its link is in their hands.
- A trip report says whether the trains came when it said.

## Not this
Accuracy tuning (`its-here`).

## Log
- 2026-10-23 first deploy (producer set up the accounts): the Worker is live at too-too-soon.justin-fc2.workers.dev and has the token, but RTT answers 401. #6 tidies the pasted token and makes `/api/info` say how it was taken and what RTT said; `probe.yml` reads it from GitHub's runners, since sessions can't reach workers.dev.
