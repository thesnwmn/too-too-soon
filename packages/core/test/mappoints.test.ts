import { describe, expect, it } from "vitest";
import { codeLabel, mapCentre, mapPoints, pointsGeoJson } from "../src/mappoints.ts";
import type { Places } from "../src/places.ts";

const places: Places = {
  v: 1,
  stations: [
    ["Brookwood", "BKO"],
    ["Woking", "WOK"],
  ],
  others: [
    ["Brookwood London End", "BRKWDLE"],
    ["Woking Jn", "WOKINGJ"],
    ["Hilsea Jcn", "HILSJCN"],
    ["Woking Up Yard", "WOKIUYD"],
    ["Junction Road Sidings", "JNCTNRD"],
    // A code in both lists is the station.
    ["Woking Platform", "WOK"],
  ],
};
const points: [string, number, number][] = [
  ["BKO", 51.3038, -0.6357],
  ["WOK", 51.3185, -0.557],
  ["WOKINGJ", 51.3111, -0.5622],
  ["BRKWDLE", 51.3056, -0.6288],
  ["HILSJCN", 50.83, -1.06],
  ["WOKIUYD", 51.319, -0.55],
  ["JNCTNRD", 51.55, -0.13],
  ["NONAME", 51.0, -1.0],
];

describe("mapPoints", () => {
  const dots = mapPoints(places, points);
  const kind = (code: string) => dots.find((d) => d.code === code)?.kind;
  it("names each point from the place list, and says what kind it is", () => {
    expect(dots.find((d) => d.code === "WOKINGJ")).toEqual({ code: "WOKINGJ", name: "Woking Jn", kind: "junction", lat: 51.3111, lon: -0.5622 });
    expect(kind("BKO")).toBe("station");
    expect(kind("HILSJCN")).toBe("junction");
    expect(kind("WOKIUYD")).toBe("other");
    expect(kind("BRKWDLE")).toBe("other");
  });
  it("takes a code in both lists as the station", () => expect(dots.find((d) => d.code === "WOK")).toMatchObject({ name: "Woking", kind: "station" }));
  it("counts a junction by the word, not the letters ('Junction Road' is a junction too, as RTT names it)", () => expect(kind("JNCTNRD")).toBe("junction"));
  it("leaves out a point the place list doesn't name", () => expect(kind("NONAME")).toBeUndefined());
});

describe("codeLabel", () => {
  it("calls a station's three letters its CRS, and anything else a TIPLOC", () => {
    expect(codeLabel({ kind: "station", code: "WOK" })).toBe("CRS");
    expect(codeLabel({ kind: "junction", code: "WOKINGJ" })).toBe("TIPLOC");
    expect(codeLabel({ kind: "station", code: "WOKING" })).toBe("TIPLOC");
  });
});

describe("mapCentre", () => {
  const known: Record<string, { lat: number; lon: number }> = { WOK: { lat: 51.3185, lon: -0.557 }, BKO: { lat: 51.3038, lon: -0.6357 }, CLJ: { lat: 51.4642, lon: -0.1702 } };
  const at = (c: string) => known[c];
  it("opens B's map on A, and A's on B, so the second is picked near the first", () => {
    expect(mapCentre(at, { box: "b", a: "WOK", b: "BKO" })).toEqual(known.WOK);
    expect(mapCentre(at, { box: "a", a: "WOK", b: "BKO" })).toEqual(known.BKO);
  });
  it("opens on the box's own place when the other is empty", () => expect(mapCentre(at, { box: "b", b: "BKO" })).toEqual(known.BKO));
  it("else on the spot being watched", () => expect(mapCentre(at, { box: "a", spotA: "CLJ" })).toEqual(known.CLJ));
  it("passes over codes the map doesn't have, and is undefined when it has none", () => {
    expect(mapCentre(at, { box: "b", a: "XYZ", spotA: "CLJ" })).toEqual(known.CLJ);
    expect(mapCentre(at, {})).toBeUndefined();
  });
});

describe("pointsGeoJson", () => {
  it("draws each dot at its longitude and latitude, with its code, name and kind", () => {
    expect(pointsGeoJson(mapPoints(places, points.slice(0, 1))).features).toEqual([
      { type: "Feature", geometry: { type: "Point", coordinates: [-0.6357, 51.3038] }, properties: { code: "BKO", name: "Brookwood", kind: "station" } },
    ]);
  });
});
