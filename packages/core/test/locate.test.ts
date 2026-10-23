import { describe, expect, it } from "vitest";
import { distance, locate, type OsmElement, overpassQuery } from "../src/locate.ts";

// A made-up stretch at 51.5° N: 500 m is about 0.00722° of longitude.
const LAT = 51.5;
const STEP = 0.00722;
const at = (x: number, dy = 0) => ({ lat: LAT + dy, lon: -0.2 + x * STEP });

/** A way through points x (in 500 m steps) along the line, with node ids from `first`. */
const way = (id: number, xs: number[], first: number, dy = 0): OsmElement => ({
  type: "way",
  id,
  tags: { railway: "rail" },
  nodes: xs.map((_, i) => first + i),
  geometry: xs.map((x) => at(x, dy)),
});
const tiploc = (id: number, code: string, name: string, x: number, dy = 0.0004): OsmElement => ({ type: "node", id, ...at(x, dy), tags: { "ref:tiploc": code, name } });

// Main line from x=0 to x=6 (3 km); stations beside the track at 0 (ASH) and 4 (BRM), another at 6 (CRN).
// A separate line 400 m north, not joined, has a station at x=1.5 (OTH): closer as the crow flies, but not on our track.
const LINE: OsmElement[] = [
  way(1, [0, 1, 2], 100),
  way(2, [2, 3, 4, 5, 6], 102),
  way(3, [0, 1, 2, 3], 200, 0.0036),
  tiploc(9001, "ASHBYJN", "Ashby Junction", 0),
  tiploc(9002, "BRMFD", "Bramford", 4),
  tiploc(9003, "CRNWL", "Cornwell", 6),
  tiploc(9004, "OTHERX", "Other Line", 1.5, 0.0036),
];

describe("locate", () => {
  it("finds the timing points either side along the track, and how far along the tap is", () => {
    const r = locate(LINE, at(1, 0.0002))!;
    expect(r.a.code).toBe("ASHBYJN");
    expect(r.b.code).toBe("BRMFD");
    expect(r.f).toBeCloseTo(0.25, 2);
    expect(r.offTrack).toBeGreaterThan(15);
    expect(r.offTrack).toBeLessThan(30);
  });
  it("walks the track, not the crow's flight: a station on another line is ignored", () => {
    const r = locate(LINE, at(2.2))!;
    expect([r.a.code, r.b.code]).toEqual(["ASHBYJN", "BRMFD"]);
  });
  it("picks the nearest on each side, not one further on", () => {
    expect(locate(LINE, at(4.6))!.b.code).toBe("CRNWL");
    expect(locate(LINE, at(4.6))!.a.code).toBe("BRMFD");
  });
  it("crosses from one way to the next", () => expect(locate(LINE, at(3.5))!.a.code).toBe("ASHBYJN"));
  it("takes the first code when a node lists several", () => {
    const r = locate([...LINE.slice(0, 4), { ...tiploc(9002, "BRMFD;BRMFDX", "Bramford", 4) }], at(1))!;
    expect(r.b.code).toBe("BRMFD");
  });
  it("gives up with no track near the tap", () => expect(locate(LINE, at(1, 0.01))).toBeUndefined());
  it("gives up with no timing point on one side", () => expect(locate([way(1, [0, 1, 2], 100), tiploc(9001, "ASHBYJN", "Ashby", 0)], at(1))).toBeUndefined());
  it("ignores a timing point too far from any track", () => expect(locate([...LINE.slice(0, 3), tiploc(9002, "BRMFD", "Bramford", 4, 0.01), tiploc(9001, "ASHBYJN", "Ashby", 0)], at(1))).toBeUndefined());
  it("copes with nothing", () => expect(locate([], at(1))).toBeUndefined());
});

describe("geometry and the query", () => {
  it("measures 500 m steps", () => expect(distance(at(0), at(1))).toBeCloseTo(500, -1));
  it("asks for rail ways with geometry and TIPLOC nodes around the tap", () => {
    const q = overpassQuery(51.5, -0.2, 4000);
    expect(q).toContain('way["railway"="rail"](around:4000,51.500000,-0.200000);out geom;');
    expect(q).toContain('node["ref:tiploc"](around:4000,51.500000,-0.200000);out;');
  });
});
