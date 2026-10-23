// From a tap on the map to a spot: snap to the nearest railway track in OpenStreetMap, walk
// the track both ways to the nearest timing points (nodes tagged ref:tiploc), and measure how
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

/** The Overpass query for railway tracks and timing points within `radius` metres of a point. */
export function overpassQuery(lat: number, lon: number, radius: number): string {
  const around = `(around:${Math.round(radius)},${lat.toFixed(6)},${lon.toFixed(6)})`;
  return `[out:json][timeout:25];way["railway"="rail"]${around};out geom;node["ref:tiploc"]${around};out;`;
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

/** A timing point's TIPLOC: the first, if the tag lists several. */
const tiplocOf = (tags: Record<string, string> = {}) => (tags["ref:tiploc"] ?? "").split(";")[0].trim().toUpperCase();

/** How close (metres) a timing point's node must be to the track to count as on it: stations are often mapped beside the rails. */
export const ATTACH_M = 250;

/**
 * The timing points either side of a tap, along the track. Undefined when there's no track
 * within 200 m, or no timing point along it on one side within the data given.
 */
export function locate(elements: OsmElement[], tap: { lat: number; lon: number }): Located | undefined {
  // The track as a graph: vertices are OSM nodes, edges the segments of rail ways.
  const pos = new Map<number, { lat: number; lon: number }>();
  const adj = new Map<number, { to: number; m: number }[]>();
  const link = (u: number, v: number, m: number) => {
    if (!adj.has(u)) adj.set(u, []);
    adj.get(u)!.push({ to: v, m });
  };
  let best: { u: number; v: number; t: number; d: number; lat: number; lon: number } | undefined;
  for (const w of elements) {
    if (w.type !== "way" || !w.nodes || !w.geometry || w.nodes.length !== w.geometry.length) continue;
    for (let i = 0; i < w.nodes.length; i++) pos.set(w.nodes[i], w.geometry[i]);
    for (let i = 1; i < w.nodes.length; i++) {
      const u = w.nodes[i - 1], v = w.nodes[i];
      const m = distance(w.geometry[i - 1], w.geometry[i]);
      link(u, v, m);
      link(v, u, m);
      const p = project(tap, w.geometry[i - 1], w.geometry[i]);
      const d = distance(tap, p);
      if (!best || d < best.d) best = { u, v, t: p.t, d, lat: p.lat, lon: p.lon };
    }
  }
  if (!best || best.d > 200) return undefined;

  // Each timing point hangs off its nearest track vertex, if it's close enough.
  const points = new Map<number, { code: string; name: string; lat: number; lon: number; gap: number }[]>();
  for (const n of elements) {
    const code = tiplocOf(n.tags);
    if (n.type !== "node" || !code || n.lat === undefined || n.lon === undefined) continue;
    let near: { id: number; d: number } | undefined;
    for (const [id, p] of pos) {
      const d = distance(p, { lat: n.lat, lon: n.lon });
      if (!near || d < near.d) near = { id, d };
    }
    if (!near || near.d > ATTACH_M) continue;
    if (!points.has(near.id)) points.set(near.id, []);
    points.get(near.id)!.push({ code, name: n.tags?.name ?? code, lat: n.lat, lon: n.lon, gap: near.d });
  }

  // Walk the track from the snapped point, one way through u and the other through v.
  const segment = distance(pos.get(best.u)!, pos.get(best.v)!);
  const walk = (start: number, startM: number, blocked: number): TimingPoint | undefined => {
    const dist = new Map<number, number>([[start, startM]]);
    const done = new Set<number>([blocked]);
    const queue: [number, number][] = [[startM, start]];
    while (queue.length) {
      queue.sort((x, y) => x[0] - y[0]);
      const [m, id] = queue.shift()!;
      if (done.has(id)) continue;
      done.add(id);
      const here = points.get(id);
      if (here) {
        const p = here.sort((x, y) => x.gap - y.gap)[0];
        return { code: p.code, name: p.name, lat: p.lat, lon: p.lon, along: m };
      }
      for (const e of adj.get(id) ?? []) {
        const next = m + e.m;
        if (!done.has(e.to) && next < (dist.get(e.to) ?? Infinity)) {
          dist.set(e.to, next);
          queue.push([next, e.to]);
        }
      }
    }
    return undefined;
  };
  // A timing point on the snapped segment's own ends counts on its own side only.
  const a = walk(best.u, best.t * segment, best.v);
  const b = walk(best.v, (1 - best.t) * segment, best.u);
  if (!a || !b || a.code === b.code) return undefined;
  return { snapped: { lat: best.lat, lon: best.lon }, offTrack: best.d, a, b, f: a.along / (a.along + b.along) };
}
