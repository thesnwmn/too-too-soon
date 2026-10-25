// The map's dots (find-on-map): points.json, made at deploy time (packed: packages/core points.ts),
// joined with the place list for names and kinds. Fetched only when the map opens, and kept on
// the phone (the Cache API) so the dots show with a weak signal at the bridge: a kept copy is used
// at once, and a fresh one fetched behind it for next time, so a new deploy's file replaces it.
import { type MapPoint, mapPoints, type PackedPoints, unpackPoints } from "@too-too-soon/core";
import { loadPlaces } from "./places.ts";

const CACHE = "too-too-soon-points";
const URL_ = "points.json";

const isJson = (r: Response | undefined) => !!r?.ok && (r.headers.get("Content-Type") ?? "").includes("json");

/** points.json from the phone's copy if there is one (refreshed behind it), else from the site. Undefined where there's none (a deploy that couldn't make it). */
async function packed(): Promise<PackedPoints | undefined> {
  let cache: Cache | undefined;
  try {
    cache = await caches.open(CACHE);
  } catch {
    // No Cache API (an old browser, or not a secure page): just the network.
  }
  const fresh = fetch(URL_).then(async (r) => {
    if (!isJson(r)) return undefined;
    await cache?.put(URL_, r.clone()).catch(() => undefined);
    return r;
  });
  const kept = await cache?.match(URL_).catch(() => undefined);
  const r = isJson(kept) ? kept : await fresh.catch(() => undefined);
  // The fresh one still lands in the cache behind a kept copy; a failure there is only for next time.
  fresh.catch(() => undefined);
  return r ? ((await r.json()) as PackedPoints) : undefined;
}

let dots: Promise<MapPoint[]> | undefined;

/** The dots, named; empty where there are no points or no place list. A failed download is tried again next time. */
export function loadMapPoints(): Promise<MapPoint[]> {
  dots ??= Promise.all([packed(), loadPlaces()])
    .then(([p, places]) => (p && places ? mapPoints(places, unpackPoints(p)) : []))
    .catch(() => [])
    .then((d) => {
      if (!d.length) dots = undefined;
      return d;
    });
  return dots;
}
