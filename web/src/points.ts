// The map's dots (find-on-map): points.json, made at deploy time (packed: packages/core points.ts),
// joined with the place list for names and kinds. Fetched only when the map opens; both files are
// kept on the phone (kept.ts) so the dots show, named, with a weak signal at the bridge.
import { type MapPoint, mapPoints, type PackedPoints, unpackPoints } from "@too-too-soon/core";
import { keptJson } from "./kept.ts";
import { loadPlaces } from "./places.ts";

let dots: Promise<MapPoint[]> | undefined;

/** The dots, named; empty where there are no points or no place list. A failed download is tried again next time. */
export function loadMapPoints(): Promise<MapPoint[]> {
  dots ??= Promise.all([keptJson<PackedPoints>("points.json"), loadPlaces()])
    .then(([p, places]) => (p && places ? mapPoints(places, unpackPoints(p)) : []))
    .catch(() => [])
    .then((d) => {
      if (!d.length) dots = undefined;
      return d;
    });
  return dots;
}
