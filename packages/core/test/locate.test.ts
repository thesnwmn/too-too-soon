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
  it("uses a station's CRS code where there's no TIPLOC, and prefers the TIPLOC where there's both", () => {
    const crs = (id: number, code: string, name: string, x: number, tiploc?: string): OsmElement => ({ type: "node", id, ...at(x, 0.0004), tags: { railway: "station", "ref:crs": code, name, ...(tiploc && { "ref:tiploc": tiploc }) } });
    const r = locate([...LINE.slice(0, 2), crs(9501, "WOK", "Woking", 0), crs(9502, "BKO", "Brookwood", 4, "BRKWOOD")], at(1.8))!;
    expect([r.a.code, r.b.code]).toEqual(["WOK", "BRKWOOD"]);
  });
});

describe("locate on real-shaped track", () => {
  // Double track: the down line and the up line about 11 m apart, as two ways, stations beside them.
  const down = way(10, [0, 1, 2, 3, 4, 5, 6], 300);
  const up = way(11, [0, 1, 2, 3, 4, 5, 6], 400, 0.0001);
  const crossover: OsmElement = { type: "way", id: 12, tags: { railway: "rail" }, nodes: [301, 401], geometry: [at(1), at(1, 0.0001)] };
  const stations = [tiploc(9101, "FARA", "Far A", 0, 0.0003), tiploc(9102, "NEARB", "Near B", 3, 0.0003)];
  it("works whichever line of double track the tap lands on", () => {
    for (const tap of [at(1.5), at(1.5, 0.0001)]) expect(locate([down, up, ...stations], tap)).toMatchObject({ a: { code: "FARA" }, b: { code: "NEARB" } });
  });
  it("isn't fooled into the other side's station by a crossover loop", () => {
    for (const tap of [at(1.5), at(1.5, 0.0001), at(0.5), at(0.5, 0.0001)]) expect(locate([down, up, crossover, ...stations], tap)).toMatchObject({ a: { code: "FARA" }, b: { code: "NEARB" } });
  });
  it("finds a halt partway along a long straight segment", () => {
    const long = way(20, [0, 2, 4], 500);
    const r = locate([long, tiploc(9201, "AA", "A", 0), tiploc(9202, "BB", "Halt", 1, 0.0002), tiploc(9203, "CC", "C", 4)], at(1.5))!;
    expect(r.a.code).toBe("BB");
    expect(r.b.code).toBe("CC");
    expect(r.f).toBeCloseTo(0.2, 1);
  });
  it("finds a station around a sharp curve", () => {
    // Out east, then hairpin back west 600 m north: B lies 'behind' the tap as the crow flies.
    const hairpin: OsmElement = { type: "way", id: 30, tags: {}, nodes: [601, 602, 603, 604], geometry: [at(0), at(2), at(2, 0.0054), at(0, 0.0054)] };
    const r = locate([hairpin, tiploc(9301, "WEST", "West", 0, 0.0001), tiploc(9302, "NORTH", "North", 0, 0.0055)], at(1))!;
    expect([r.a.code, r.b.code].sort()).toEqual(["NORTH", "WEST"]);
  });
});

describe("geometry and the query", () => {
  it("measures 500 m steps", () => expect(distance(at(0), at(1))).toBeCloseTo(500, -1));
  it("asks for rail ways with geometry and TIPLOC nodes around the tap", () => {
    const q = overpassQuery(51.5, -0.2, 4000);
    expect(q).toContain('way["railway"="rail"][!"service"](around:4000,51.500000,-0.200000);out skel geom qt;');
    expect(q).toContain('node["ref:tiploc"](around:4000,51.500000,-0.200000);');
    expect(q).toContain('node["ref:crs"](around:4000,51.500000,-0.200000);');
  });
});
