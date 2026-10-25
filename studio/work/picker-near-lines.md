---
title: A station beside two lines is only on its own
kind: fix
role: engineer
status: idea
milestone: m1-first-trains
---

## Why
The Tester, on `picker-offline` (#35): `locate` hangs a station off every track within 250 m (`ATTACH_M`), so where lines run close (Clapham, approaching Battersea), a tap on the Brighton line picked Queenstown Road, on the South Western main line, and RTT would show the wrong line's trains. The Overpass path did the same.

## Log
- 2026-10-25 raised from the Tester's report on #35. A thought: hang a station only off the tracks within a few metres of its nearest one (double track, the lines through its platforms), not every track within 250 m.
