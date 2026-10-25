// The dots on the map (find-on-map): each placed point (points.json) with its name and kind from
// the place list (places.json), joined by code, and where the map should open. Pure, so the page
// draws what these say and the tests check them. See docs/how-it-works.md#setting-up-a-spot.

import type { Places } from "./places.ts";

export type PointKind = "station" | "junction" | "other";

export interface MapPoint {
  /** What RTT takes for it, as the place list has it: a station's CRS, a timing point's TIPLOC. */
  code: string;
  name: string;
  kind: PointKind;
  lat: number;
  lon: number;
}

/** RTT's and BPLAN's ways of writing "junction": "Woking Jn", "Hilsea Jcn", "Leeds West Jct". */
const JUNCTION = /\b(jn|jcn|jct|jnc|junc|junction)\b\.?/i;

/**
 * The dots: each placed point that the place list names. A code in both lists is the station (as
 * compactPoints takes it). A point the place list doesn't name isn't drawn: there'd be nothing to
 * call it, and RTT wouldn't know it.
 */
export function mapPoints(places: Places, points: [string, number, number][]): MapPoint[] {
  const named = new Map<string, { name: string; kind: PointKind }>();
  for (const [name, code] of places.others) named.set(code, { name, kind: JUNCTION.test(name) ? "junction" : "other" });
  for (const [name, code] of places.stations) named.set(code, { name, kind: "station" });
  const out: MapPoint[] = [];
  for (const [code, lat, lon] of points) {
    const n = named.get(code);
    if (n) out.push({ code, name: n.name, kind: n.kind, lat, lon });
  }
  return out;
}

/** What a kind is called on the card. */
export const KIND_TEXT: Record<PointKind, string> = { station: "Station", junction: "Junction", other: "Timing point" };

/** What the code is called on the card: a station's three letters are its CRS; anything else is a TIPLOC. */
export const codeLabel = (p: Pick<MapPoint, "kind" | "code">) => (p.kind === "station" && /^[A-Z]{3}$/.test(p.code) ? "CRS" : "TIPLOC");

/**
 * Where the map opens: on the other box's place when finding one for a box (so B is picked near
 * A), else that box's own, else the spot being watched; undefined when none is on the map (then
 * near you, or Great Britain). Codes not on the map are passed over.
 */
export function mapCentre(
  at: (code: string) => { lat: number; lon: number } | undefined,
  o: { box?: "a" | "b"; a?: string; b?: string; spotA?: string; spotB?: string },
): { lat: number; lon: number } | undefined {
  const order = o.box === "b" ? [o.a, o.b] : o.box === "a" ? [o.b, o.a] : [o.a, o.b];
  for (const code of [...order, o.spotA, o.spotB]) {
    const p = code ? at(code) : undefined;
    if (p) return p;
  }
  return undefined;
}

/** The dots as GeoJSON, for the map to draw (and cluster when zoomed out). */
export function pointsGeoJson(points: MapPoint[]) {
  return {
    type: "FeatureCollection" as const,
    features: points.map((p) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
      properties: { code: p.code, name: p.name, kind: p.kind },
    })),
  };
}
