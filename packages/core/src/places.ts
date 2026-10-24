// Stations and timing points by name, so setting up a spot doesn't need RTT's codes. The list is
// RTT's own (/data/stops and /data/locations_ungrouped), made small at deploy time by compactPlaces
// and searched in the page by searchPlaces. See docs/how-it-works.md#setting-up-a-spot.

/** An entry of RTT's /data/locations_ungrouped. */
export interface RttLocation {
  description?: string;
  shortCode?: string;
  longCode?: string;
}

/** An entry of RTT's /data/stops: somewhere passengers can get on and off. */
export interface RttStop {
  description?: string;
  shortCode?: string;
}

/** The shipped list: stations as [name, CRS], then other timing points as [name, TIPLOC]. */
export interface Places {
  v: 1;
  stations: [string, string][];
  others: [string, string][];
}

export interface Place {
  name: string;
  /** What RTT takes for it: a station's CRS code, or a timing point's TIPLOC. */
  code: string;
  station: boolean;
}

const byName = (x: [string, string], y: [string, string]) => x[0].localeCompare(y[0], "en-GB");

/** The small list to ship, from RTT's two. Stations by their CRS code; every other named timing point by its TIPLOC, skipping a station's own parts and bus stops. */
export function compactPlaces(locations: RttLocation[], stops: RttStop[]): Places {
  const stations = new Map<string, string>();
  for (const s of stops) if (s.shortCode && s.description?.trim()) stations.set(s.shortCode.toUpperCase(), s.description.trim());
  // A big station's platforms can be timing points of their own with the station's name: the station stands for them.
  const stationNames = new Set([...stations.values()].map(fold));
  const others = new Map<string, string>();
  for (const l of locations) {
    const name = l.description?.trim();
    const code = l.longCode?.toUpperCase();
    if (!name || !code || !/^[A-Z0-9]{3,7}$/.test(code)) continue;
    if ((l.shortCode && stations.has(l.shortCode.toUpperCase())) || stationNames.has(fold(name))) continue;
    if (/\bbus( station| stop)?$/i.test(name)) continue;
    others.set(code, name);
  }
  return { v: 1, stations: [...stations].map(([c, n]) => [n, c] as [string, string]).sort(byName), others: [...others].map(([c, n]) => [n, c] as [string, string]).sort(byName) };
}

/** Lower case, letters and digits only, "&" as "and", "St." as "st", RTT's "Jn" as "junction": what's compared. */
const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bjn\b/g, "junction")
    .trim();

/**
 * Places matching what's typed, best first: a code typed exactly, then stations, then other
 * timing points. Within each, names starting with what's typed before names with a word that
 * does, then shorter names. Every word typed has to start a word of the name.
 */
export function searchPlaces(places: Places, query: string, limit = 8): Place[] {
  const q = fold(query);
  if (!q) return [];
  const words = q.split(" ");
  const code = query.trim().toUpperCase();
  const scored: { place: Place; score: number }[] = [];
  const consider = (list: [string, string][], station: boolean) => {
    for (const [name, c] of list) {
      const f = fold(name);
      const exactCode = c === code;
      const nameWords = f.split(" ");
      const all = words.every((w) => nameWords.some((n) => n.startsWith(w)));
      if (!exactCode && !all) continue;
      const score = (exactCode ? 0 : 1000) + (station ? 0 : 500) + (f === q ? 0 : f.startsWith(q) ? 100 : 200) + Math.min(f.length, 99);
      scored.push({ place: { name, code: c, station }, score });
    }
  };
  consider(places.stations, true);
  consider(places.others, false);
  return scored
    .sort((x, y) => x.score - y.score || x.place.name.localeCompare(y.place.name, "en-GB"))
    .slice(0, limit)
    .map((s) => s.place);
}
