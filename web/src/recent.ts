// The spots watched on this phone, newest first, so going back to one is a tap. Kept in
// localStorage as each spot's link query; the store is passed in so the tests can fake it.
import { parseSpot, type Spot, spotParams } from "@too-too-soon/core";

export const RECENT = "too-too-soon:spots";
/** Where the page kept its one spot before the list. */
export const OLD = "too-too-soon:spot";
export const MAX_RECENT = 5;

type Store = Pick<Storage, "getItem" | "setItem">;

/** The same place on the line: a name change doesn't make it another spot. f as the link rounds it. */
const same = (x: Spot, y: Spot) => x.a === y.a && (x.b ?? "") === (y.b ?? "") && (!x.b || Math.round(x.f * 1000) === Math.round(y.f * 1000));

function parse(q: string): Spot | undefined {
  const r = parseSpot(new URLSearchParams(q));
  return "spot" in r ? r.spot : undefined;
}

/** The spots remembered, newest first; none if storage is blocked or holds nonsense. */
export function recentSpots(store: Store): Spot[] {
  try {
    const raw = store.getItem(RECENT);
    if (raw === null) {
      // Before the list there was one spot: it carries over as the first.
      const old = store.getItem(OLD);
      const spot = old ? parse(old) : undefined;
      return spot ? [spot] : [];
    }
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.flatMap((q) => (typeof q === "string" ? (parse(q) ?? []) : [])).slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function save(store: Store, spots: Spot[]): Spot[] {
  try {
    store.setItem(RECENT, JSON.stringify(spots.map((s) => spotParams(s).toString())));
  } catch {
    // Private browsing: the link still holds the spot.
  }
  return spots;
}

/** Watched: to the top of the list, replacing an older copy, and the oldest falls off past five. */
export function remember(store: Store, spot: Spot): Spot[] {
  return save(store, [spot, ...recentSpots(store).filter((s) => !same(s, spot))].slice(0, MAX_RECENT));
}

export function forget(store: Store, spot: Spot): Spot[] {
  return save(store, recentSpots(store).filter((s) => !same(s, spot)));
}
