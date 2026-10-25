// A name for a spot picked on the map (auto-name): the road or path that crosses the railway
// nearest where you tapped, from the map's own tiles, so a bridge is called after its road. Pure:
// the page decodes the tiles and hands their lines in.

import { distance } from "./locate.ts";
import type { LatLon } from "./tiles.ts";

/** A named road or path from the tiles (OpenMapTiles' `transportation_name`). */
export interface NamedLine {
  name: string;
  points: LatLon[];
  /** The tiles' `brunnel`: "bridge" where the line goes over something. */
  brunnel?: string;
}

/** How far (metres) from the spot on the line a crossing can be and still name it. */
export const NAME_REACH_M = 150;

/**
 * How near (metres) a bridge segment must cross the track to the named crossing to make it "… bridge".
 * A footbridge right beside a level crossing would make it a bridge too: rare, and a name you can change.
 */
const SAME_CROSSING_M = 30;

/** Where segments p1–p2 and q1–q2 cross, in a flat frame round `o`; undefined if they don't. */
function crossing(o: LatLon, p1: LatLon, p2: LatLon, q1: LatLon, q2: LatLon): LatLon | undefined {
  const k = Math.cos((o.lat * Math.PI) / 180);
  const xy = (p: LatLon) => [(p.lon - o.lon) * k, p.lat - o.lat];
  const [a, b, c, d] = [xy(p1), xy(p2), xy(q1), xy(q2)];
  const r = [b[0] - a[0], b[1] - a[1]];
  const s = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (den === 0) return undefined;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
  const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return undefined;
  return { lat: p1.lat + t * (p2.lat - p1.lat), lon: p1.lon + t * (p2.lon - p1.lon) };
}

/** Every place a line crosses the track. */
function crossings(o: LatLon, line: LatLon[], track: LatLon[][]): LatLon[] {
  const out: LatLon[] = [];
  for (let i = 1; i < line.length; i++)
    for (const t of track)
      for (let j = 1; j < t.length; j++) {
        const x = crossing(o, line[i - 1], line[i], t[j - 1], t[j]);
        if (x) out.push(x);
      }
  return out;
}

/** "Hermitage Road bridge" for a road over the line, "Hermitage Road" otherwise; a name that already says bridge stays as it is. */
export function roadSpotName(name: string, bridge: boolean): string {
  return bridge && !/\bbridge\b/i.test(name) ? `${name} bridge` : name;
}

/**
 * The name for a spot at `at` on the track: the named road or path crossing the track nearest
 * it, within NAME_REACH_M, as roadSpotName says. `bridges` are the tiles' other lines with
 * `brunnel=bridge` (the named lines are merged and can lose it), to tell a bridge where one of
 * them crosses the track at the same place. Undefined when nothing named crosses near enough.
 */
export function nameAtTrack(at: LatLon, track: LatLon[][], roads: NamedLine[], bridges: LatLon[][] = []): string | undefined {
  let best: { name: string; where: LatLon; bridge: boolean; d: number } | undefined;
  for (const r of roads)
    for (const where of crossings(at, r.points, track)) {
      const d = distance(at, where);
      if (d <= NAME_REACH_M && (!best || d < best.d)) best = { name: r.name, where, bridge: r.brunnel === "bridge", d };
    }
  if (!best) return undefined;
  const near = best.where;
  const bridge = best.bridge || bridges.some((b) => crossings(near, b, track).some((x) => distance(near, x) <= SAME_CROSSING_M));
  return roadSpotName(best.name, bridge);
}
