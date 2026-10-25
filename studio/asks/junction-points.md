---
title: Junctions on the map need Network Rail's list. Download it once for us?
from: engineer
status: answered
blocks: [map-junctions]
default: Stations only on the map. Junctions and other timing points are still found by name in the search.
expires: after 3 sessions
gated: true                 # an account only the producer can open
---

The map will show every station (from NaPTAN, the government's open list of stops, no account needed). Junctions, yards and signals aren't in it. Network Rail's own list of timing points (BPLAN) has them all, with where they are, but it's only downloadable with a free Network Rail Open Data account, and sessions and GitHub's servers can't get behind the login.

BPLAN changes slowly (mostly with the May and December timetables), and its licence (Open Government Licence) lets us keep a copy with credit. So the login is never stored anywhere: not in GitHub's secrets, the Worker or the page.

Options:
- **Stations only** (the default): nothing to do. For a bridge between two stations, as yours is (Brookwood and Woking), that's all you need.
- **Download it once** (recommended if you watch near a junction): open a free account at publicdatafeeds.networkrail.co.uk, download the BPLAN file from its reference data, and give it to a session (drop it in, or attach it to a GitHub issue). The studio cuts it down to the timing points and their places and commits that; the deploy adds them to the map. A fresh download every year or so keeps it current, and the old one keeps working if nobody does. You can close the account afterwards.

## Where to get it

Unchecked: sessions can't reach these sites, so the names may have moved.
1. **The account:** free, at https://publicdatafeeds.networkrail.co.uk/ntrod/create-account (Network Rail Open Data). Approval can take a day.
2. **The file:** once logged in, it's among the reference data, not the live feeds: look for "BPLAN" (Network Rail's Geography / timing point data), a zip of a few MB, often a `.txt` inside, with lines starting `LOC`. If it isn't there: Network Rail has been moving its open data to the Rail Data Marketplace (https://raildata.org.uk, also free): search there for "BPLAN".
3. **To us:** drop the zip in a session, or attach it to a new GitHub issue in this repo, titled "BPLAN".

## Answer
2026-10-25, partly: the producer, worried about the deploy holding an email and password, asked whether the file could be downloaded once and kept instead: "Yes" to the studio doing it that way. Then they sent an older BPLAN (`Geography_20240602_to_20241214_from_20240524.txt.gz`, 11,886 locations, 6,302 with a place) in a session, while getting the current one.
