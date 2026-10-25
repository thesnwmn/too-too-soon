import { describe, expect, it } from "vitest";
import { distance, locate } from "../src/locate.ts";
import { dotNodes, fromTrack, isRunningLine, type LatLon, tileKey, tileOf, tilesAhead, tilesAround, tracksFromLines } from "../src/tiles.ts";

// A made-up stretch at 51.5° N: 500 m is about 0.00722° of longitude.
const LAT = 51.5;
const STEP = 0.00722;
const at = (x: number, dy = 0): LatLon => ({ lat: LAT + dy, lon: -0.2 + x * STEP });
const line = (xs: number[], dy = 0) => xs.map((x) => at(x, dy));
const dot = (code: string, x: number, dy = 0.0004) => ({ code, name: code, ...at(x, dy) });

/** Where a tile's edges are, in degrees. */
const edges = (t: { z: number; x: number; y: number }) => {
  const n = 2 ** t.z;
  const lat = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  return { west: (t.x / n) * 360 - 180, east: ((t.x + 1) / n) * 360 - 180, north: lat(t.y), south: lat(t.y + 1) };
};

describe("tiles", () => {
  it("finds the tile a point is in", () => {
    expect(tileOf({ lat: 0.1, lon: 0.1 }, 0)).toEqual({ z: 0, x: 0, y: 0 });
    const woking = { lat: 51.3185, lon: -0.557 };
    const e = edges(tileOf(woking));
    expect(woking.lon).toBeGreaterThanOrEqual(e.west);
    expect(woking.lon).toBeLessThan(e.east);
    expect(woking.lat).toBeLessThanOrEqual(e.north);
    expect(woking.lat).toBeGreaterThan(e.south);
  });
  it("gives the tiles around a point, the one it's in first", () => {
    const p = { lat: 51.3185, lon: -0.557 };
    const ts = tilesAround(p, 2000);
    expect(tileKey(ts[0])).toBe(tileKey(tileOf(p)));
    // 2 km either way at zoom 14 (about 1.5 km tiles here) is 3 or 4 tiles each way.
    expect(ts.length).toBeGreaterThanOrEqual(9);
    expect(ts.length).toBeLessThanOrEqual(16);
    expect(new Set(ts.map(tileKey)).size).toBe(ts.length);
  });
  it("takes running lines only", () => {
    expect(isRunningLine({ class: "rail", subclass: "rail" })).toBe(true);
    expect(isRunningLine({ class: "rail", subclass: "rail", brunnel: "bridge" })).toBe(true);
    expect(isRunningLine({ class: "rail", subclass: "rail", service: "siding" })).toBe(false);
    expect(isRunningLine({ class: "rail", subclass: "rail", service: "crossover" })).toBe(false);
    expect(isRunningLine({ class: "rail", subclass: "tram" })).toBe(false);
    expect(isRunningLine({ class: "transit", subclass: "subway" })).toBe(false);
    expect(isRunningLine({ class: "minor" })).toBe(false);
  });
});

describe("track from tile lines", () => {
  it("joins a line cut at a tile edge, where both tiles carry it a little past the edge", () => {
    // West tile to x=3.05, east tile from x=2.95; the east tile's points sit 40 cm off (its own grid).
    const west = line([0, 1, 2, 3.05]);
    const east = line([2.95, 4, 5, 6], 0.0000036);
    const r = locate([...tracksFromLines([west, east]), ...dotNodes([dot("AAA", 0), dot("BBB", 6)])], at(2))!;
    expect([r.a.code, r.b.code]).toEqual(["AAA", "BBB"]);
    expect(r.f).toBeCloseTo(2 / 6, 2);
  });
  it("measures to a station just past where one tile's line stops, along the next tile's", () => {
    // The west tile's line stops at 3.05; the station is at 3.1, so 550 m from a tap at 2, not 525.
    const r = locate([...tracksFromLines([line([0, 1, 2, 3.05]), line([2.95, 4, 5, 6], 0.0000036)]), ...dotNodes([dot("AAA", 0), dot("BBB", 3.1, 0)])], at(2))!;
    expect(r.b.code).toBe("BBB");
    expect(r.b.along).toBeCloseTo(distance(at(2), at(3.1)), 0);
  });
  it("joins the same point in two tiles, and two lines that meet", () => {
    const r = locate([...tracksFromLines([line([0, 1, 2]), line([2, 3, 4])]), ...dotNodes([dot("AAA", 0), dot("BBB", 4)])], at(3))!;
    expect([r.a.code, r.b.code]).toEqual(["AAA", "BBB"]);
  });
  it("doesn't join double track, or a line that stops short", () => {
    // The up line 11 m north; a second line stopping 20 m short of the first.
    const ways = tracksFromLines([line([0, 1, 2]), line([0, 1, 2], 0.0001), line([2.04, 3, 4])]);
    expect(new Set(ways.flatMap((w) => w.nodes!)).size).toBe(9);
    expect(locate([...ways, ...dotNodes([dot("AAA", 0), dot("BBB", 4)])], at(1))).toBeUndefined();
  });
  it("joins a cut end partway along a long segment, at the point it's at", () => {
    const ways = tracksFromLines([line([0, 4]), line([2, 2.5], 0.00001)]);
    // The short one lies alongside (1 m off): both its ends move onto the long one, which gains a point for each.
    const [long, short] = ways;
    expect(long.nodes!.slice(1, 3)).toEqual(short.nodes);
    expect(ways[0].geometry!.map((p) => Math.round((p.lon + 0.2) / STEP * 10) / 10)).toEqual([0, 2, 2.5, 4]);
  });
});

describe("how far from the track", () => {
  it("measures to the nearest line", () => {
    const ways = tracksFromLines([line([0, 2]), line([0, 2], 0.01)]);
    expect(fromTrack(ways, at(1, 0.0009))).toBeCloseTo(100, -1);
    expect(fromTrack([], at(1))).toBe(Infinity);
  });
});

describe("the tiles to fetch next", () => {
  // A line west to east across the tile the tap is in, cut a little past the tile's east and west edges.
  const tap = { lat: 51.3185, lon: -0.557 };
  const t = tileOf(tap);
  const e = edges(t);
  const past = (e.east - e.west) * 0.015;
  const across = [{ lat: tap.lat, lon: e.west - past }, tap, { lat: tap.lat, lon: e.east + past }];
  it("are the tiles past each cut end, nearest first", () => {
    const next = tilesAhead(tracksFromLines([across]), tap, new Set([tileKey(t)])).tiles;
    expect(next.map(tileKey).sort()).toEqual([tileKey({ ...t, x: t.x - 1 }), tileKey({ ...t, x: t.x + 1 })].sort());
  });
  it("are none when the line ends in the tiles there are", () => {
    const have = new Set([t, { ...t, x: t.x - 1 }, { ...t, x: t.x + 1 }].map(tileKey));
    expect(tilesAhead(tracksFromLines([across]), tap, have)).toEqual({ tiles: [], cut: new Set() });
  });
  it("follow branches joined to the tap's track, not lines that aren't", () => {
    const north = { lat: e.north + (e.north - e.south) * 0.015, lon: tap.lon };
    const branch = [tap, north];
    const apart = [{ lat: e.south - 0.001, lon: e.west + 0.001 }, { lat: e.south - 0.001, lon: e.west + 0.002 }];
    const next = tilesAhead(tracksFromLines([across, branch, apart]), tap, new Set([tileKey(t)])).tiles;
    expect(next.map(tileKey)).toContain(tileKey({ ...t, y: t.y - 1 }));
    expect(next.map(tileKey)).not.toContain(tileKey({ ...t, y: t.y + 1 }));
  });
  it("are none with no track", () => expect(tilesAhead([], tap, new Set()).tiles).toEqual([]));
  it("name the cut ends, so a station just past one isn't hung off it", () => {
    // The line stops at x=2 (a tile's edge); a station 200 m further on, beside where the line would go.
    const ways = tracksFromLines([line([0, 1, 2])]);
    const dots = dotNodes([dot("AAA", 0), dot("BBB", 2.4, 0)]);
    expect(locate([...ways, ...dots], at(1))).toMatchObject({ b: { code: "BBB" } });
    const end = ways[0].nodes!.at(-1)!;
    expect(locate([...ways, ...dots], at(1), new Set([end]))).toBeUndefined();
  });
});
