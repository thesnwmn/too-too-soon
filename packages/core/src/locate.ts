// From a tap on the map to a spot: snap to the nearest railway track in OpenStreetMap, walk
// the track both ways to the nearest timing points (nodes tagged ref:tiploc, or failing that
// stations tagged ref:crs, which RTT also takes), and measure how
// far along from A to B the tap is. Pure: the page asks Overpass and hands the answer in.
// See docs/how-it-works.md#setting-up-a-spot.

/** What Overpass answers for `overpassQuery`: rail ways with their geometry, and TIPLOC nodes. */
export interface OsmElement {
  type: "node" | "way" | string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  /** A way's node ids, in order. */
  nodes?: number[];
  /** A way's node positions, in the same order (from `out geom`). */
  geometry?: { lat: number; lon: number }[];
}

export interface TimingPoint {
  code: string;
  name: string;
  lat: number;
  lon: number;
  /** Metres along the track from the tap. */
  along: number;
}

export interface Located {
  /** The tap, snapped onto the track. */
  snapped: { lat: number; lon: number };
  /** How far the tap was from the track, in metres. */
  offTrack: number;
  a: TimingPoint;
  b: TimingPoint;
  /** How far along from A to B the spot is. */
  f: number;
}

/** The Overpass query for running lines and timing points within `radius` metres of a point. */
export function overpassQuery(lat: number, lon: number, radius: number): string {
  const around = `(around:${Math.round(radius)},${lat.toFixed(6)},${lon.toFixed(6)})`;
  // Running lines only: sidings, yards and crossovers would snap a tap to the wrong track.
  // TIPLOCs are patchy in OSM (none for miles around Woking), but stations nearly always have a CRS code.
  return `[out:json][timeout:25];way["railway"="rail"][!"service"]${around};out geom;(node["ref:tiploc"]${around};node["railway"~"^(station|halt)$"]["ref:crs"]${around};);out;`;
}

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Metres between two points. */
export function distance(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The nearest point on segment pq to x, as a fraction t along it (flat-earth: segments are short). */
function project(x: { lat: number; lon: number }, p: { lat: number; lon: number }, q: { lat: number; lon: number }): { t: number; lat: number; lon: number } {
  const k = Math.cos(rad(p.lat));
  const px = p.lon * k, py = p.lat, qx = q.lon * k, qy = q.lat, xx = x.lon * k, xy = x.lat;
  const dx = qx - px, dy = qy - py;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((xx - px) * dx + (xy - py) * dy) / len2));
  return { t, lat: p.lat + t * (q.lat - p.lat), lon: p.lon + t * (q.lon - p.lon) };
}

/** A timing point's code for RTT: its TIPLOC (the first, if it lists several), or else a station's CRS code. */
const tiplocOf = (tags: Record<string, string> = {}) => (tags["ref:tiploc"] || tags["ref:crs"] || "").split(";")[0].trim().toUpperCase();

/** How close (metres) a timing point's node must be to a track to count as on it: stations are often mapped beside the rails. */
export const ATTACH_M = 250;

interface Edge {
  u: number;
  v: number;
  m: number;
  p: { lat: number; lon: number };
  q: { lat: number; lon: number };
}
interface Stop {
  code: string;
  name: string;
  lat: number;
  lon: number;
  /** How far from the track the node is, to pick the closest of several at one place. */
  gap: number;
}

/**
 * The timing points either side of a tap, along the track. Undefined when there's no track
 * within 200 m, or no timing point along it on one side within the data given.
 *
 * Each timing point hangs off every track segment within ATTACH_M (double track is two ways in
 * OSM, and the tap may land on either), at the point along the segment nearest it. Then the
 * track is walked both ways from the tap, and the nearest timing point found ahead on each side
 * wins: "ahead" meaning it lies that side of the tap along the track's local direction, so a
 * walk that loops back through a crossover can't find the other side's station.
 */
export function locate(elements: OsmElement[], tap: { lat: number; lon: number }): Located | undefined {
  const edges: Edge[] = [];
  const adj = new Map<number, number[]>();
  for (const w of elements) {
    if (w.type !== "way" || !w.nodes || !w.geometry || w.nodes.length !== w.geometry.length) continue;
    for (let i = 1; i < w.nodes.length; i++) {
      const e: Edge = { u: w.nodes[i - 1], v: w.nodes[i], m: distance(w.geometry[i - 1], w.geometry[i]), p: w.geometry[i - 1], q: w.geometry[i] };
      const k = edges.push(e) - 1;
      for (const n of [e.u, e.v]) {
        if (!adj.has(n)) adj.set(n, []);
        adj.get(n)!.push(k);
      }
    }
  }
  let snap: { e: number; t: number; d: number; lat: number; lon: number } | undefined;
  edges.forEach((e, k) => {
    const pr = project(tap, e.p, e.q);
    const d = distance(tap, pr);
    if (!snap || d < snap.d) snap = { e: k, t: pr.t, d, lat: pr.lat, lon: pr.lon };
  });
  if (!snap || snap.d > 200) return undefined;
  const s0 = snap;

  // Timing points, on every segment near enough.
  const onEdge = new Map<number, { t: number; stop: Stop }[]>();
  for (const n of elements) {
    const code = tiplocOf(n.tags);
    if (n.type !== "node" || !code || n.lat === undefined || n.lon === undefined) continue;
    const at = { lat: n.lat, lon: n.lon };
    edges.forEach((e, k) => {
      const pr = project(at, e.p, e.q);
      const gap = distance(at, pr);
      if (gap > ATTACH_M) return;
      if (!onEdge.has(k)) onEdge.set(k, []);
      onEdge.get(k)!.push({ t: pr.t, stop: { code, name: n.tags?.name ?? code, lat: n.lat!, lon: n.lon!, gap } });
    });
  }

  // Which way is "towards u" at the tap, flat-earth: a stop counts for a side only if it lies that way.
  const se = edges[s0.e];
  const k = Math.cos(rad(se.p.lat));
  const dir = { x: (se.p.lon - se.q.lon) * k, y: se.p.lat - se.q.lat };
  const side = (pt: { lat: number; lon: number }) => Math.sign((pt.lon - s0.lon) * k * dir.x + (pt.lat - s0.lat) * dir.y);

  const walk = (sign: 1 | -1, strict = true): TimingPoint | undefined => {
    let found: { m: number; stop: Stop } | undefined;
    const consider = (m: number, stop: Stop) => {
      if (strict && side(stop) !== sign && side(stop) !== 0) return;
      if (!found || m < found.m - 1 || (Math.abs(m - found.m) <= 1 && stop.gap < found.stop.gap)) found = { m, stop };
    };
    // Stops on the tap's own segment, on this side of it.
    for (const { t, stop } of onEdge.get(s0.e) ?? []) {
      if (sign === 1 && t <= s0.t) consider((s0.t - t) * se.m, stop);
      if (sign === -1 && t >= s0.t) consider((t - s0.t) * se.m, stop);
    }
    const start = sign === 1 ? se.u : se.v;
    const dist = new Map<number, number>([[start, sign === 1 ? s0.t * se.m : (1 - s0.t) * se.m]]);
    const done = new Set<number>();
    const queue: [number, number][] = [[dist.get(start)!, start]];
    while (queue.length) {
      queue.sort((x, y) => x[0] - y[0]);
      const [m, id] = queue.shift()!;
      if (done.has(id)) continue;
      if (found && m > found.m) break;
      done.add(id);
      for (const ek of adj.get(id) ?? []) {
        if (ek === s0.e) continue;
        const e = edges[ek];
        const forward = e.u === id;
        for (const { t, stop } of onEdge.get(ek) ?? []) consider(m + (forward ? t : 1 - t) * e.m, stop);
        const other = forward ? e.v : e.u;
        const next = m + e.m;
        if (!done.has(other) && next < (dist.get(other) ?? Infinity)) {
          dist.set(other, next);
          queue.push([next, other]);
        }
      }
    }
    return found && { code: found.stop.code, name: found.stop.name, lat: found.stop.lat, lon: found.stop.lon, along: found.m };
  };
  // On a curve sharp enough that a station lies "behind" the tap, try again without the side test.
  const a = walk(1) ?? walk(1, false);
  const b = walk(-1) ?? walk(-1, false);
  if (!a || !b || a.code === b.code) return undefined;
  return { snapped: { lat: s0.lat, lon: s0.lon }, offTrack: s0.d, a, b, f: a.along / (a.along + b.along) };
}
