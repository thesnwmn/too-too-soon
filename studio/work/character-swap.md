---
title: Swap to the logo the producer picks, if it isn't A
kind: build
role: designer
size: S
status: shaped
needs: [logo]
---

## Why
`character` shipped direction A and asked the producer (`logo`). If they pick B or C, or ask for changes, this does it.

## Done when
- The chosen logo is `web/public/icon.svg`, its PNGs redrawn (`pnpm --filter @too-too-soon/web icons`), and the word mark in `web/src/brand.ts` matches it.
- The same checks as `character`: readable at 16 px, the picker one screen, the countdown no smaller.

## Not this
Anything else about the page. If the producer keeps A, this is dropped.

## Log
- 2026-10-24 shaped with the `logo` ask.
