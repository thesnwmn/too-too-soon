import { describe, expect, it } from "vitest";
import { OTHERS_KEY, othersOn, setOthersOn } from "../src/toggle.ts";

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
