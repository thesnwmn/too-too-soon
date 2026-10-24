---
title: A logo and a word mark with character
kind: build
role: designer
size: M
status: trial
pr: 18
---

## Why
The producer, 2026-10-24: "I'd like to add more character to the design. Maybe a logo (steam train based or something), maybe a word mark. Fun for kids and obvious what it relates to." The page is plain slate and green now, with a placeholder icon; a child at the bridge should recognise it as *the train one*.

## Done when
- A logo: a friendly steam train (puffing, round, simple shapes) that still reads at 32 px as a favicon and as a home-screen icon, as SVG with the PNG sizes the manifest uses regenerated from it.
- A word mark, "Too Too Soon", that carries the same character (the "too too" of a whistle, steam puffs), used in the page header instead of the plain `<h1>` on the set-up and watch views.
- The colours: a small palette drawn from the logo (engine green, smoke, a warm accent) in `style.css`'s variables, light and dark, with the countdown still at least 7:1 contrast in sunlight.
- Three directions are drawn first and shown on the PR (screenshots at phone width); the studio ships the one it recommends, and an ask `logo` lets the producer pick another (default: the recommended one stands).
- The map picker stays one screen with no scroll at 390×844, 375×667 and 360×640; the watch view's countdown is no smaller.
- No new runtime dependencies or web fonts that cost a request on a slow signal: inline SVG, system fonts or a font subset under 20 KB.

## Not this
- Animation beyond something tiny (a puff on the countdown hitting zero is a later idea).
- Characters with faces that look like anyone else's train (no Thomas look-alikes): our own.
- Changing what the page shows or how it predicts.

## Log
- 2026-10-24 shaped by the Director from the producer's word; the Designer takes it.
- 2026-10-24 started (#18). Drew three directions (an engine, a cloud, a badge: `studio/design/character/`) and shipped A: a yellow engine puffing on green as the icon, drawn into the page, and "Too Too Soon" with each "oo" as driving wheels on a coupling rod. The countdown's yellow on green was 6.9:1 (5.4:1 in dark); now 7.8:1, with freight 8.2:1, held by `web/test/contrast.test.ts`. The Tester caught freight text vanishing in dark mode (its own colour now) and the spot's name wrapping at 360 px ("Change" there). Ask `logo` for B or C; trial: does a child spot it as the train one? [Session](../sessions/2026-10-24-1330-character.md).
