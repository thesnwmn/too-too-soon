# The demo's places and points

The demo on GitHub Pages has no Worker and no RTT token, so the deploy can't make `places.json` and `points.json` for it. These are a small real sample instead, around Woking and Brookwood, copied into the page by `.github/workflows/pages.yml`: the search and the map's dots work there for these 14 places (BPLAN's abbreviated names written out).

The stations are from NaPTAN, and the timing points from Network Rail's BPLAN (2 June to 14 December 2024), both under the Open Government Licence. `code/places` and `code/points` check them.

So on Pages the search offers only these 14; a code typed in capitals (CLJ) still works, but a name or a lower-case code outside them asks you to pick from the list.
