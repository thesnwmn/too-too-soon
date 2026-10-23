import { describe, expect, it } from "vitest";
import type { Pass } from "@too-too-soon/core";
import { clock, countdown, direction, inMinutes, refreshAfter, sureness, what } from "../src/format.ts";

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
