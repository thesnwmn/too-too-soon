import { describe, expect, it } from "vitest";
import { OTHERS_KEY, othersNeeded, othersOn, setOthersOn, splitDots } from "../src/toggle.ts";

function store() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

describe("the timing points switch", () => {
  it("is off by default", () => expect(othersOn(store())).toBe(false));
  it("is remembered once turned on, and forgotten when turned off", () => {
    const s = store();
    setOthersOn(s, true);
    expect(othersOn(s)).toBe(true);
    setOthersOn(s, false);
    expect(othersOn(s)).toBe(false);
    expect(s.m.has(OTHERS_KEY)).toBe(false);
  });
  it("is off, and nothing breaks, with no storage or blocked storage", () => {
    expect(othersOn(undefined)).toBe(false);
    const blocked = { getItem: () => { throw new Error("SecurityError"); }, setItem: () => { throw new Error("SecurityError"); }, removeItem: () => { throw new Error("SecurityError"); } };
    expect(othersOn(blocked)).toBe(false);
    expect(() => setOthersOn(blocked, true)).not.toThrow();
  });
});

describe("splitDots and othersNeeded", () => {
  const dots = [
    { code: "WOK", kind: "station" },
    { code: "WOKINGJ", kind: "junction" },
    { code: "WOKIUYR", kind: "other" },
  ];
  const kindOf = (c: string) => dots.find((d) => d.code === c)?.kind;
  it("keeps the stations apart from the junctions and other timing points", () => {
    const { stations, others } = splitDots(dots);
    expect(stations.map((d) => d.code)).toEqual(["WOK"]);
    expect(others.map((d) => d.code)).toEqual(["WOKINGJ", "WOKIUYR"]);
  });
  it("shows the others for a visit when a box or the spot holds one", () => {
    expect(othersNeeded(kindOf, ["WOK", "WOKINGJ"])).toBe(true);
    expect(othersNeeded(kindOf, [undefined, undefined, "WOKIUYR"])).toBe(true);
  });
  it("not for stations, empty boxes, or codes the map doesn't have", () => {
    expect(othersNeeded(kindOf, ["WOK", undefined, "CLJ"])).toBe(false);
  });
});
