---
title: Find on map: every timing point on the map, tap one to see it and use it
kind: build
role: engineer
size: M
status: shaped
milestone: m1-first-trains
needs: [point-coords]
---

## Why
The producer, 2026-10-25, via /director: "on the map picker can we show all timing points clearly and show details of them (code, name, type, whatever else) if you click them. The user could use this to manually fill in the form. A 'find on map'. And when you've got one selected the other will always open the map centered on that so picking the next is in the same area."

The map picker now asks OpenStreetMap's Overpass server on each tap, which has never worked for the producer (#21). Points drawn from our own file need no server at the moment you tap.

## Done when
- Each place box on the set-up form (the one place, timing point A, timing point B) has a "Find on map" button.
- The map shows every timing point from `point-coords` as a dot, stations and junctions told apart by colour or shape, with names once zoomed in. They're drawn from the shipped file, with no Overpass request. At low zoom they're thinned or clustered so the map stays readable and fast on a phone.
- Tapping a dot opens a small card: name, kind (station, junction, other timing point), TIPLOC, CRS if it has one, and anything else the file knows. A "Use this" button fills that box (code and name, as picking from the search does) and goes back to the form, keeping the rest of the form as it was.
- The same dots and card in "Pick on a map", so from any point the map can jump to filling the form: the card offers "Use as the one place", "Use as A" and "Use as B", and goes to the form with that box filled and One place or Between two set to match. With two points, you set how far along with the slider yourself. So the map works both ways: pick the exact spot (the track tap, when `picker-offline` makes it work), or a quick way to fill the form.
- With one box filled, Find on map for the other opens centred on the filled point, zoomed in close enough to see the points around it. With none filled, it opens on the current spot if there is one, else near you if you allow it, else on Great Britain. "Pick on a map" opens centred the same way.
- It fits one screen with no scroll at 390×844, 375×667 and 360×640, the card included; checked by the Tester, and on the producer's phone at their bridge (Brookwood, Woking).
- Works in the demo on Pages (no Worker).

## Not this
Tapping the track to work out how far along the spot is (the existing picker; `picker-offline`). Filtering points by type, or searching from the map (the search box does that).

## Log
- 2026-10-25 shaped by the Director from the producer's /director. Defaults the producer can change: a button on each box, the card shows the codes and kind, the map opens on the filled point.
- 2026-10-25 the producer, adding to it: "from any point on the picker it can jump to filling the form. So you can use the map as a 'pick a specific spot' (when we make that work) or a picker for filling the form and the user does the %age bit themselves if using two points." Added to Done when.
