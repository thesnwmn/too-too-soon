import { describe, expect, it } from "vitest";
import type { Pass } from "@too-too-soon/core";
import { about, clock, countdown, direction, inMinutes, refreshAfter, stopping, sureness, what } from "../src/format.ts";

const NOW = Date.parse("2026-10-24T14:00:00Z");
const pass = (over: Partial<Pass>): Pass => ({ id: "x", time: NOW, basis: "forecast", direction: "ab", passenger: true, stopsBefore: false, stopsAfter: false, timeA: NOW, timeB: NOW, ...over });

describe("the words", () => {
  it("shows UK time whatever the phone's set to, summer time included", () => {
    expect(clock(Date.parse("2026-10-24T14:07:00Z"))).toBe("15:07");
    expect(clock(Date.parse("2026-12-24T14:07:00Z"))).toBe("14:07");
  });
  it("counts down, then says now, then gone", () => {
    expect(countdown(NOW + 204_000, NOW)).toBe("3:24");
    expect(countdown(NOW + 20_000, NOW)).toBe("now!");
    expect(countdown(NOW - 25_000, NOW)).toBe("gone");
    expect(countdown(NOW + 75 * 60_000, NOW)).toBe("1h 15");
    expect(inMinutes(NOW + 4 * 60_000, NOW)).toBe("in 4 min");
  });
  it("points the way, with names from the spot first", () => {
    const spot = { name: "B", a: "AAA", b: "BBB", f: 0.5, bName: "Bramford" };
    expect(direction(pass({ direction: "ab" }), spot)).toEqual({ arrow: "➡", towards: "Bramford" });
    expect(direction(pass({ direction: "ba" }), spot, { a: "Ashby Junction" })).toEqual({ arrow: "⬅", towards: "Ashby Junction" });
  });
  it("says what it is", () => {
    expect(what(pass({ coaches: 10, destination: "London Waterloo" }))).toBe("10 coaches to London Waterloo");
    expect(what(pass({ passenger: false, headcode: "6M41" }))).toBe("Freight train");
    expect(what(pass({ passenger: false, headcode: "5Z90" }))).toBe("Empty train");
    expect(what(pass({ passenger: false, headcode: "3S84" }))).toBe("Special train");
    expect(what(pass({ passenger: false, headcode: "0Y42" }))).toBe("Engine on its own");
    expect(what(pass({ passenger: false }))).toBe("Freight train");
    expect(what(pass({ passenger: false, headcode: "9T12" }))).toBe("Empty train");
  });
  it("says who runs it, what it is and where from", () => {
    expect(about(pass({ operator: "South Western Railway", trainClass: "159", origin: "London Waterloo", destination: "Yeovil Junction" }))).toBe("South Western Railway · Class 159 · from London Waterloo");
    expect(about(pass({ passenger: false, operator: "Freightliner", origin: "Southampton Docks", destination: "Birmingham" }))).toBe("Freightliner · Southampton Docks to Birmingham");
    // As RTT sent 3S84: no operator's name, out from the sidings and back.
    expect(about(pass({ passenger: false, origin: "Effingham Jn. C.H.S.", destination: "Effingham Jn. C.H.S." }))).toBe("from Effingham Jn. C.H.S. and back");
    expect(about(pass({}))).toBe("");
  });
  it("names the station it stops at, whichever way it's going", () => {
    const spot = { name: "B", a: "BKO", b: "WOK", f: 0.5, aName: "Brookwood", bName: "Woking" };
    expect(stopping(pass({ direction: "ab", stopsAfter: true }), spot)).toBe("stopping at Woking");
    expect(stopping(pass({ direction: "ba", stopsAfter: true }), spot)).toBe("stopping at Brookwood");
    expect(stopping(pass({ direction: "ba", stopsBefore: true }), spot)).toBe("just left Woking");
    expect(stopping(pass({ direction: "ab", stopsBefore: true, stopsAfter: true }), spot)).toBe("stops at Brookwood and Woking");
    expect(stopping(pass({}), spot)).toBe("fast: not stopping");
  });
  it("says how sure", () => {
    expect(sureness(pass({ late: 6 }))).toBe("6 min late");
    expect(sureness(pass({ late: 0 }))).toBe("on time");
    expect(sureness(pass({ basis: "timetable" }))).toBe("timetable only");
  });
  it("asks every minute when a train is close, every two when not", () => {
    expect(refreshAfter([pass({ time: NOW + 5 * 60_000 })], NOW)).toBe(60_000);
    expect(refreshAfter([pass({ time: NOW + 25 * 60_000 })], NOW)).toBe(120_000);
    expect(refreshAfter([], NOW)).toBe(120_000);
  });
});
