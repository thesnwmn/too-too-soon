import { type MapPoint, type Tile, tileKey, tileOf } from "@too-too-soon/core";
import { PbfWriter } from "pbf";
import { afterEach, describe, expect, it, vi } from "vitest";
import { findOnTiles, nameOnTiles, railLines, roadLines } from "../src/track.ts";

const EXTENT = 4096;
const n = 2 ** 14;
/** A point's place in a tile, in the tile's own units. */
const inTile = (t: Tile, p: { lat: number; lon: number }) => {
  const r = (p.lat * Math.PI) / 180;
  const wx = ((p.lon + 180) / 360) * n;
  const wy = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  return [Math.round((wx - t.x) * EXTENT), Math.round((wy - t.y) * EXTENT)];
};

/** A vector tile with a `transportation` layer (or `layer`) of these lines, as OpenMapTiles writes them. */
function tile(t: Tile, lines: { props: Record<string, string>; points: { lat: number; lon: number }[] }[], layer = "transportation"): ArrayBuffer {
  const keys: string[] = [];
  const values: string[] = [];
  const pbf = new PbfWriter();
  pbf.writeMessage(3, (_: unknown, w: PbfWriter) => {
    w.writeVarintField(15, 2);
    w.writeStringField(1, layer);
    for (const l of lines) {
      w.writeMessage(2, (_: unknown, f: PbfWriter) => {
        const tags = Object.entries(l.props).flatMap(([k, v]) => {
          if (!keys.includes(k)) keys.push(k);
          if (!values.includes(v)) values.push(v);
          return [keys.indexOf(k), values.indexOf(v)];
        });
        f.writePackedVarint(2, tags);
        f.writeVarintField(3, 2);
        const zz = (v: number) => (v << 1) ^ (v >> 31);
        const pts = l.points.map((p) => inTile(t, p));
        const geom = [(1 << 3) | 1, zz(pts[0][0]), zz(pts[0][1]), ((pts.length - 1) << 3) | 2];
        for (let i = 1; i < pts.length; i++) geom.push(zz(pts[i][0] - pts[i - 1][0]), zz(pts[i][1] - pts[i - 1][1]));
        f.writePackedVarint(4, geom);
      }, undefined);
    }
    for (const k of keys) w.writeStringField(3, k);
    for (const v of values) w.writeMessage(4, (_: unknown, m: PbfWriter) => m.writeStringField(1, v), undefined);
    w.writeVarintField(5, EXTENT);
  }, undefined);
  const b = pbf.finish();
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

const RAIL = { class: "rail", subclass: "rail" };
const src = { template: "https://tiles.example/{z}/{x}/{y}.pbf", maxzoom: 14 };
const woking = { lat: 51.3185, lon: -0.557 };
/** About `km` east of Woking. */
const east = (km: number) => ({ lat: woking.lat, lon: woking.lon + km / (111.32 * Math.cos((woking.lat * Math.PI) / 180)) });
const dot = (code: string, p: { lat: number; lon: number }): MapPoint => ({ code, name: code, kind: "station", ...p });

/** Every tile a straight line from x km to y km east crosses, each with its bit of the line (cut 30 m past its edges, as tiles are). */
function lineTiles(fromKm: number, toKm: number, props: Record<string, string> = RAIL) {
  const tiles = new Map<string, ArrayBuffer>();
  const t0 = tileOf(east(fromKm)).x, t1 = tileOf(east(toKm)).x;
  const y = tileOf(woking).y;
  for (let x = t0; x <= t1; x++) {
    const t = { z: 14, x, y };
    const west = Math.max(fromKm, ((x / n) * 360 - 180 - woking.lon) * 111.32 * Math.cos((woking.lat * Math.PI) / 180) - 0.03);
    const eastKm = Math.min(toKm, (((x + 1) / n) * 360 - 180 - woking.lon) * 111.32 * Math.cos((woking.lat * Math.PI) / 180) + 0.03);
    const pts = [west, ...[...Array(20)].map((_, i) => fromKm + ((toKm - fromKm) * i) / 19).filter((k) => k > west && k < eastKm), eastKm].map(east);
    tiles.set(tileKey(t), tile(t, [{ props, points: pts }]));
  }
  return tiles;
}

function serve(tiles: Map<string, ArrayBuffer>) {
  const asked: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    const k = url.match(/(\d+\/\d+\/\d+)\.pbf$/)![1];
    asked.push(k);
    const b = tiles.get(k);
    return b ? new Response(b) : new Response(null, { status: 404 });
  });
  return asked;
}
afterEach(() => vi.unstubAllGlobals());
const signal = new AbortController().signal;

describe("railLines", () => {
  it("reads a tile's running lines in degrees, and leaves out sidings and trams", () => {
    const t = tileOf(woking);
    const buf = tile(t, [
      { props: RAIL, points: [woking, east(0.5)] },
      { props: { ...RAIL, service: "siding" }, points: [woking, east(0.3)] },
      { props: { class: "rail", subclass: "tram" }, points: [woking, east(0.3)] },
    ]);
    const lines = railLines(buf, t);
    expect(lines).toHaveLength(1);
    expect(lines[0][0].lat).toBeCloseTo(woking.lat, 5);
    expect(lines[0][1].lon).toBeCloseTo(east(0.5).lon, 5);
  });
});

describe("findOnTiles", () => {
  it("finds the stations either side along the tiles' track", async () => {
    serve(lineTiles(-3, 3));
    const r = await findOnTiles(src, east(0.2), [dot("WWW", east(-1)), dot("EEE", east(1))], signal);
    expect(r).toMatchObject({ a: { code: "WWW" }, b: { code: "EEE" } });
  });
  it("fetches more tiles along the line when a station is further out", async () => {
    const asked = serve(lineTiles(-10, 10));
    const r = await findOnTiles(src, east(0), [dot("WWW", east(-1)), dot("FAR", east(7))], signal);
    if (!r || typeof r === "string") throw new Error(`found ${r}`);
    const far = r.a.code === "FAR" ? r.a : r.b;
    expect([r.a.code, r.b.code].sort()).toEqual(["FAR", "WWW"]);
    expect(far.along).toBeCloseTo(7000, -2);
    // Beyond the first few: the tiles out to 7 km east.
    expect(asked).toContain(tileKey(tileOf(east(7))));
    expect(asked).not.toContain(tileKey(tileOf(east(-9))));
  });
  it("waits for the tiles past a cut nearer than what it found, so a branch's station doesn't beat a nearer one past the edge", async () => {
    const tiles = lineTiles(-10, 10);
    // The first tiles reach a little past 1.5 km east; the main line's next station is 200 m past their edge.
    const t = tileOf(east(1.5));
    const edgeKm = ((((t.x + 1) / n) * 360 - 180 - woking.lon) * 111.32 * Math.cos((woking.lat * Math.PI) / 180));
    const nearStation = east(edgeKm + 0.2);
    // A branch from 300 m east, 450 m north, then east: its station is further along than the main line's, but in the first tiles.
    const up = { lat: woking.lat + 0.004, lon: east(0.3).lon };
    const branchEnd = { lat: up.lat, lon: east(edgeKm + 0.5).lon };
    const home = tileOf(woking);
    const rail = (points: { lat: number; lon: number }[]) => ({ props: RAIL, points });
    const mainHere = railLines(tiles.get(tileKey(home))!, home).map(rail);
    tiles.set(tileKey(home), tile(home, [...mainHere, rail([east(0.3), up, branchEnd])]));
    serve(tiles);
    const r = await findOnTiles(src, east(0), [dot("WWW", east(-1)), dot("BRANCH", { ...branchEnd, lat: branchEnd.lat + 0.0003 }), dot("NEAR", nearStation)], signal);
    if (!r || typeof r === "string") throw new Error(`found ${r}`);
    expect([r.a.code, r.b.code].sort()).toEqual(["NEAR", "WWW"]);
  });
  it("says there's no track where the tiles have no rail near the tap", async () => {
    serve(lineTiles(-3, 3));
    expect(await findOnTiles(src, { lat: woking.lat + 0.01, lon: woking.lon }, [dot("WWW", east(-1)), dot("EEE", east(1))], signal)).toBe("no track");
  });
  it("says the tap missed when there's track a few hundred metres off (OpenStreetMap couldn't help)", async () => {
    serve(lineTiles(-3, 3));
    expect(await findOnTiles(src, { lat: woking.lat + 0.003, lon: woking.lon }, [dot("WWW", east(-1)), dot("EEE", east(1))], signal)).toBe("missed");
  });
  it("gives up when there's no station one way, without fetching the whole country", async () => {
    const asked = serve(lineTiles(-30, 30));
    expect(await findOnTiles(src, east(0), [dot("WWW", east(-1))], signal)).toBeUndefined();
    expect(asked.length).toBeLessThanOrEqual(40);
  });
});

/** Two layers in one tile: a tile's layers are just one after another. */
const both = (a: ArrayBuffer, b: ArrayBuffer) => {
  const out = new Uint8Array(a.byteLength + b.byteLength);
  out.set(new Uint8Array(a), 0);
  out.set(new Uint8Array(b), a.byteLength);
  return out.buffer;
};

describe("nameOnTiles", () => {
  const t = tileOf(woking);
  /** A road north–south across the line, about `km` east of Woking. */
  const road = (km: number) => [{ lat: woking.lat - 0.001, lon: east(km).lon }, { lat: woking.lat + 0.001, lon: east(km).lon }];
  const rail = { props: RAIL, points: [east(-0.3), east(0.3)] };
  const named = (props: Record<string, string>, km = 0.05) => tile(t, [{ props, points: road(km) }], "transportation_name");

  it("names the spot after the road crossing the line there, a bridge from the unnamed lines", async () => {
    const buf = both(tile(t, [rail, { props: { class: "minor", brunnel: "bridge" }, points: road(0.05) }]), named({ class: "minor", name: "Hermitage Road" }));
    expect(roadLines(buf, t).roads.map((r) => r.name)).toEqual(["Hermitage Road"]);
    serve(new Map([[tileKey(t), buf]]));
    expect(await nameOnTiles(src, woking, new AbortController().signal)).toBe("Hermitage Road bridge");
  });

  it("a level crossing or a road under the line is just the road", async () => {
    serve(new Map([[tileKey(t), both(tile(t, [rail]), named({ class: "minor", name: "Station Road" }))]]));
    expect(await nameOnTiles(src, woking, new AbortController().signal)).toBe("Station Road");
  });

  it("nothing named across the line within reach: no name, and the railway's own name doesn't count", async () => {
    serve(new Map([[tileKey(t), both(tile(t, [rail]), both(named({ class: "minor", name: "Far Lane" }, 0.25), tile(t, [{ props: { class: "rail", name: "South Western Main Line" }, points: [east(-0.3), east(0.3)] }], "transportation_name")))]]));
    expect(await nameOnTiles(src, woking, new AbortController().signal)).toBeUndefined();
  });

  it("no tiles (no signal): no name, and no error", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("offline");
    });
    expect(await nameOnTiles(src, woking, new AbortController().signal)).toBeUndefined();
  });
});
