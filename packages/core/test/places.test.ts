import { describe, expect, it } from "vitest";
import { compactPlaces, placeFor, placesProblems, searchPlaces } from "../src/places.ts";

// As RTT sent them on 2026-10-24 (a few of 2,623 stops and 12,116 locations).
const stops = [
  { description: "Brookwood", shortCode: "BKO" },
  { description: "Woking", shortCode: "WOK" },
  { description: "Wokingham", shortCode: "WKM" },
  { description: "Clapham Junction", shortCode: "CLJ" },
  { description: "St. Albans City", shortCode: "SAC" },
];
const locations = [
  { description: "Brookwood", shortCode: "BKO", longCode: "BRKWOOD" },
  { description: "Brookwood Country End", longCode: "BRKWDCE" },
  { description: "Brookwood London End", longCode: "BRKWDLE" },
  { description: "Woking", shortCode: "WOK", longCode: "WOKING" },
  { description: "Woking Junction", longCode: "WOKINGJ" },
  { description: "Woking Signal Wk506", longCode: "WOKI100" },
  { description: "Clapham Junction", shortCode: "CLJ", longCode: "CLPHMJN" },
  { description: "Clapham Yard", longCode: "CLPHMYD" },
  { description: "Clapham Junction", longCode: "CLPHMJ1" },
  { description: "Woking Jn", longCode: "WOKJN" },
  { description: "Penywaun Bus", shortCode: "XPZ", longCode: "ABDAPEN" },
  { description: "", longCode: "NONAME" },
];
const places = compactPlaces(locations, stops);

describe("compactPlaces", () => {
  it("keeps stations by their CRS code, and other timing points by TIPLOC", () => {
    expect(places.stations).toContainEqual(["Woking", "WOK"]);
    expect(places.others).toContainEqual(["Woking Junction", "WOKINGJ"]);
  });
  it("leaves out a station's own location, bus stops and nameless places", () => {
    const codes = places.others.map(([, c]) => c);
    expect(codes).not.toContain("WOKING");
    expect(codes).not.toContain("ABDAPEN");
    expect(codes).not.toContain("NONAME");
    // A platform timing point with the station's own name.
    expect(codes).not.toContain("CLPHMJ1");
  });
  it("stays small enough to ship: about 12,000 places in under 500 KB", () => {
    const many = Array.from({ length: 12_000 }, (_, i) => ({ description: `Somewhere Signal Wk${i}`, longCode: `S${i}`.padEnd(7, "X") }));
    const manyStops = Array.from({ length: 2_600 }, (_, i) => ({ description: `Station number ${i}`, shortCode: `Q${String(i).padStart(2, "0")}`.slice(0, 3) }));
    expect(JSON.stringify(compactPlaces(many, manyStops)).length).toBeLessThan(500_000);
  });
});

describe("searchPlaces", () => {
  const names = (q: string) => searchPlaces(places, q).map((p) => p.name);
  it("puts stations first, then junctions and the rest", () => {
    expect(names("wok")).toEqual(["Woking", "Wokingham", "Woking Jn", "Woking Junction", "Woking Signal Wk506"]);
  });
  it("finds a word inside the name, every word typed", () => {
    expect(names("junction")).toEqual(["Clapham Junction", "Woking Jn", "Woking Junction"]);
    expect(names("woking junc")).toEqual(["Woking Jn", "Woking Junction"]);
    expect(names("clap junc")).toEqual(["Clapham Junction"]);
    expect(names("brookwood end")).toEqual(["Brookwood London End", "Brookwood Country End"]);
  });
  it("ignores case, punctuation and a full stop", () => {
    expect(names("st albans")).toEqual(["St. Albans City"]);
  });
  it("finds a code typed exactly, first", () => {
    expect(searchPlaces(places, "CLPHMYD")[0]).toEqual({ name: "Clapham Yard", code: "CLPHMYD", station: false });
    expect(searchPlaces(places, "wok")[0]).toEqual({ name: "Woking", code: "WOK", station: true });
  });
  it("says nothing for nothing, and keeps to the limit", () => {
    expect(searchPlaces(places, "  ")).toEqual([]);
    expect(searchPlaces(places, "w", 2)).toHaveLength(2);
  });
});

describe("placeFor", () => {
  it("takes a name typed in full, or a code, but not a guess", () => {
    expect(placeFor(places, "woking")?.code).toBe("WOK");
    expect(placeFor(places, "St Albans City")?.code).toBe("SAC");
    expect(placeFor(places, "clphmyd")?.name).toBe("Clapham Yard");
    expect(placeFor(places, "Wokin")).toBeUndefined();
    expect(placeFor(places, "BATH")).toBeUndefined();
  });
});

describe("placesProblems", () => {
  it("passes what compactPlaces makes, and says what's wrong with anything else", () => {
    expect(placesProblems(JSON.stringify(places))).toEqual([]);
    expect(placesProblems("{")).toEqual(["not JSON"]);
    expect(placesProblems(JSON.stringify({ v: 2, stations: [["A", "AAA"]], others: [] }))).toEqual(["version 2, not 1"]);
  });
});
