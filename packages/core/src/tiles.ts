// The track from the map's own vector tiles (picker-offline), for locate: the tiles' rail lines
// made into ways that join up across tile edges, our own dots as the timing points, and which
// tiles to fetch next when the walk runs off the edge of those it has. Pure: the page fetches and
// decodes the tiles and hands their lines in. See docs/how-it-works.md#setting-up-a-spot.

import { distance, type OsmElement } from "./locate.ts";

export interface LatLon {
  lat: number;
  lon: number;
}

/** A tile in the usual web map scheme: x from the west, y from the north, at zoom z. */
export interface Tile {
  z: number;
  x: number;
  y: number;
}

/** OpenFreeMap's tiles go to zoom 14 (about 1.5 km across in the south of England). */
export const TILE_ZOOM = 14;

/** The tile a point is in. */
export function tileOf(p: LatLon, z = TILE_ZOOM): Tile {
  const n = 2 ** z;
  const r = (p.lat * Math.PI) / 180;
  const x = Math.floor(((p.lon + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  return { z, x: Math.min(n - 1, Math.max(0, x)), y: Math.min(n - 1, Math.max(0, y)) };
}

export const tileKey = (t: Tile) => `${t.z}/${t.x}/${t.y}`;

/** The tiles within `m` metres of a point, nearest first: the one it's in, and the ring around it. */
export function tilesAround(p: LatLon, m: number, z = TILE_ZOOM): Tile[] {
  const dLat = m / 111_320;
  const dLon = m / (111_320 * Math.cos((p.lat * Math.PI) / 180));
  const nw = tileOf({ lat: p.lat + dLat, lon: p.lon - dLon }, z);
  const se = tileOf({ lat: p.lat - dLat, lon: p.lon + dLon }, z);
  const c = tileOf(p, z);
  const out: Tile[] = [];
  for (let x = nw.x; x <= se.x; x++) for (let y = nw.y; y <= se.y; y++) out.push({ z, x, y });
  return out.sort((s, t) => Math.hypot(s.x - c.x, s.y - c.y) - Math.hypot(t.x - c.x, t.y - c.y));
}

/**
 * Whether a tile's feature is a running line, as Overpass was asked for (`railway=rail`, no
 * `service`): OpenMapTiles' `transportation` layer calls rail `class=rail`, with `subclass` the
 * OSM railway tag, and keeps `service` for sidings, yards, spurs and crossovers.
 */
export function isRunningLine(props: Record<string, unknown>): boolean {
  return props.class === "rail" && (props.subclass === undefined || props.subclass === "rail") && !props.service;
}

/** How near (metres) a line's loose end must be to another line to join it: a tile cuts its lines a little past its edge, where the next tile's carry on. */
export const JOIN_M = 3;

/**
 * The tiles' rail lines as ways for locate. A tile's lines have no OSM node ids, so a point is
 * known by where it is (to about 10 cm): the same point in two tiles, or where two lines meet,
 * is one node. A tile cuts each line a little past its edge, so a loose end within JOIN_M of
 * another line is moved onto it, at the nearest point along it, and becomes a node of both. The overlap this leaves near a
 * tile edge is two lines on top of each other, which the walk doesn't mind.
 */
export function tracksFromLines(lines: LatLon[][]): OsmElement[] {
  const ids = new Map<string, number>();
  const idOf = (p: LatLon) => {
    const k = `${Math.round(p.lat * 1e6)},${Math.round(p.lon * 1e6)}`;
    let id = ids.get(k);
    if (id === undefined) ids.set(k, (id = ids.size + 1));
    return id;
  };
  const ways = lines.filter((l) => l.length > 1).map((l) => l.map((p) => ({ ...p, id: idOf(p) })));
  const degree = new Map<number, number>();
  for (const w of ways) for (let i = 0; i < w.length; i++) degree.set(w[i].id, (degree.get(w[i].id) ?? 0) + (i === 0 || i === w.length - 1 ? 1 : 2));

  // Each loose end, to the nearest point on any other segment within JOIN_M (not its own way's last segment).
  const cuts = new Map<number, { i: number; t: number; p: LatLon & { id: number } }[]>();
  const moves: { wi: number; end: number; to: LatLon & { id: number } }[] = [];
  ways.forEach((w, wi) => {
    for (const end of [0, w.length - 1]) {
      const e = w[end];
      if (degree.get(e.id) !== 1) continue;
      let best: { wj: number; i: number; t: number; d: number; p: LatLon } | undefined;
      ways.forEach((v, wj) => {
        for (let i = 1; i < v.length; i++) {
          if (wj === wi && (i === end || i === end + 1)) continue;
          if (!within(e, v[i - 1], v[i], NEAR_DEG)) continue;
          const pr = nearest(e, v[i - 1], v[i]);
          const d = distance(e, pr);
          if (d <= JOIN_M && (!best || d < best.d)) best = { wj, i, t: pr.t, d, p: pr };
        }
      });
      if (!best) continue;
      const { wj, i, t, p } = best;
      const at = t === 0 ? ways[wj][i - 1] : t === 1 ? ways[wj][i] : { ...p, id: idOf(p) };
      if (t > 0 && t < 1) {
        if (!cuts.has(wj)) cuts.set(wj, []);
        cuts.get(wj)!.push({ i, t, p: at });
      }
      if (at.id !== e.id) moves.push({ wi, end, to: at });
    }
  });
  // Put the joining points into the lines they're on, in order along each segment.
  for (const [wj, cs] of cuts) {
    const w = ways[wj];
    cs.sort((c, d) => d.i - c.i || d.t - c.t);
    for (const c of cs) w.splice(c.i, 0, c.p);
  }
  // Then each loose end onto the point it joins (its way's first or last point, after any cuts in its own way).
  for (const { wi, end, to } of moves) ways[wi][end === 0 ? 0 : ways[wi].length - 1] = to;
  return ways.map((w, i) => ({ type: "way", id: i + 1, nodes: w.map((p) => p.id), geometry: w.map(({ lat, lon }) => ({ lat, lon })) }));
}

/** About JOIN_M in degrees, with room: for skipping segments nowhere near cheaply. */
const NEAR_DEG = 0.0001;

/** Whether x is within `d` degrees of the box around segment pq. */
const within = (x: LatLon, p: LatLon, q: LatLon, d: number) =>
  x.lat >= Math.min(p.lat, q.lat) - d && x.lat <= Math.max(p.lat, q.lat) + d && x.lon >= Math.min(p.lon, q.lon) - 2 * d && x.lon <= Math.max(p.lon, q.lon) + 2 * d;

/** How far (metres) a point is from the nearest track among these ways; Infinity with none. */
export function fromTrack(ways: OsmElement[], p: LatLon): number {
  let best = Infinity;
  for (const w of ways) {
    const g = w.type === "way" ? w.geometry : undefined;
    for (let i = 1; g && i < g.length; i++) best = Math.min(best, distance(p, nearest(p, g[i - 1], g[i])));
  }
  return best;
}

/** The nearest point on segment pq to x, and how far along it (flat-earth: segments are short). */
function nearest(x: LatLon, p: LatLon, q: LatLon): LatLon & { t: number } {
  const k = Math.cos((p.lat * Math.PI) / 180);
  const dx = (q.lon - p.lon) * k, dy = q.lat - p.lat;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x.lon - p.lon) * k * dx + (x.lat - p.lat) * dy) / len2));
  return { t, lat: p.lat + t * (q.lat - p.lat), lon: p.lon + t * (q.lon - p.lon) };
}

/** Our dots as the timing points locate walks to, by the code RTT takes (a station's CRS, else a TIPLOC). */
export function dotNodes(dots: { code: string; name: string; lat: number; lon: number }[]): OsmElement[] {
  return dots.map((d, i) => ({ type: "node", id: -(i + 1), lat: d.lat, lon: d.lon, tags: { "ref:tiploc": d.code, name: d.name } }));
}

/**
 * Where the track joined to the tap's was cut at the edge of the tiles there are: its loose ends
 * with a tile just past them that isn't had yet (`cut`, node ids, for locate), and those tiles,
 * to fetch next if locate doesn't find a timing point both ways, nearest the tap first. None
 * when every end is a real end (a buffer stop, or the line's end in tiles already had).
 */
export function tilesAhead(ways: OsmElement[], tap: LatLon, have: Set<string>, z = TILE_ZOOM): { tiles: Tile[]; cut: Set<number> } {
  const adj = new Map<number, { to: number; at: LatLon; from: LatLon }[]>();
  let near: { id: number; d: number } | undefined;
  for (const w of ways) {
    if (w.type !== "way" || !w.nodes || !w.geometry) continue;
    for (let i = 1; i < w.nodes.length; i++) {
      const [u, v, p, q] = [w.nodes[i - 1], w.nodes[i], w.geometry[i - 1], w.geometry[i]];
      if (u === v) continue;
      for (const [s, t, sp, tp] of [[u, v, p, q], [v, u, q, p]] as const) {
        if (!adj.has(s)) adj.set(s, []);
        adj.get(s)!.push({ to: t, at: tp, from: sp });
      }
      for (const [n, pt] of [[u, p], [v, q]] as const) {
        const d = distance(tap, pt);
        if (!near || d < near.d) near = { id: n, d };
      }
    }
  }
  const cut = new Set<number>();
  if (!near) return { tiles: [], cut };
  // Every node joined to the tap's track; its loose ends are those with one neighbour.
  const seen = new Set([near.id]);
  const stack = [near.id];
  const ahead: { t: Tile; d: number }[] = [];
  while (stack.length) {
    const n = stack.pop()!;
    const out = adj.get(n) ?? [];
    if (new Set(out.map((o) => o.to)).size === 1) {
      // Just past the end, along the line's last bit.
      const { at: back, from: end } = out[0];
      const m = Math.max(distance(back, end), 0.1);
      const past = { lat: end.lat + ((end.lat - back.lat) * 50) / m, lon: end.lon + ((end.lon - back.lon) * 50) / m };
      for (const t of [tileOf(end, z), tileOf(past, z)]) if (!have.has(tileKey(t))) ahead.push({ t, d: distance(tap, end) }), cut.add(n);
    }
    for (const o of out) if (!seen.has(o.to)) seen.add(o.to), stack.push(o.to);
  }
  const keys = new Set<string>();
  const tiles = ahead
    .sort((s, t) => s.d - t.d)
    .map((a) => a.t)
    .filter((t) => !keys.has(tileKey(t)) && !!keys.add(tileKey(t)));
  return { tiles, cut };
}
