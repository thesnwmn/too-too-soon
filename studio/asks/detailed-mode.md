---
title: Passing trains and freight need RTT's detailed mode. Pay for it, or live without?
from: release
status: open
blocks: [go-live]
default: Live without for now. The site lists trains that stop at both timing points, which is most trains on suburban lines; it says plainly that fast trains and freight may be missing.
expires: after 3 sessions
gated: false
---

The free RTT token works, but `/api/info` lists no entitlements: no `allowDetailed`. Without it RTT lists only trains that call at a location, so at a bridge between two stations the site shows the stopping trains but not the fast ones that run through, and probably no freight or empty trains (the most exciting ones for a child). The live probes on 2026-10-23 (Clapham Junction to Earlsfield, Earlsfield to Wimbledon) only ever showed trains stopping at both ends.

Options:
- **Ask RTT, or pay** (recommended if your bridge has fast trains or freight): RTT's paid self-service plans start at about £4 a month (hobbyist); check on api-portal.rtt.io which plan includes detailed mode, or ask hello@realtimetrains.com whether the free plan can have it for personal use. Nothing in the code changes: the next `/api/info` shows `detailed: true`.
- **Network Rail's own feeds** (free, full detail): needs an always-on computer (a Raspberry Pi or a small VM) and a few sessions of work. See the notes' always-on hosting doc.
- **Live without for now**: fine if your bridge is between stations where everything stops.
