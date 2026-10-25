import { describe, expect, it } from "vitest";
import type { Spot } from "@too-too-soon/core";
import { forget, MAX_RECENT, OLD, RECENT, recentSpots, remember } from "../src/recent.ts";

/** localStorage, in a Map. */
function store(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

const bridge: Spot = { name: "Our bridge", a: "BKO", b: "WOK", f: 0.52, aName: "Brookwood", bName: "Woking" };
const woking: Spot = { name: "Woking", a: "WOK", f: 0, aName: "Woking" };
const spot = (i: number): Spot => ({ name: `Spot ${i}`, a: `PLACE${i}`, f: 0 });

describe("recent spots", () => {
  it("starts empty", () => expect(recentSpots(store())).toEqual([]));

  it("remembers spots newest first", () => {
    const s = store();
    remember(s, bridge);
    remember(s, woking);
    expect(recentSpots(s).map((x) => x.name)).toEqual(["Woking", "Our bridge"]);
  });

  it("moves a spot watched again to the top, without a second copy, under its newest name", () => {
    const s = store();
    remember(s, bridge);
    remember(s, woking);
    remember(s, { ...bridge, name: "The footbridge", f: 0.5200001 });
    expect(recentSpots(s).map((x) => x.name)).toEqual(["The footbridge", "Woking"]);
  });

  it("tells spots between the same two places apart by how far along they are", () => {
    const s = store();
    remember(s, bridge);
    remember(s, { ...bridge, name: "Further on", f: 0.8 });
    expect(recentSpots(s)).toHaveLength(2);
  });

  it(`keeps ${MAX_RECENT}, dropping the oldest`, () => {
    const s = store();
    for (let i = 1; i <= MAX_RECENT + 2; i++) remember(s, spot(i));
    expect(recentSpots(s).map((x) => x.name)).toEqual(["Spot 7", "Spot 6", "Spot 5", "Spot 4", "Spot 3"]);
  });

  it("forgets a spot", () => {
    const s = store();
    remember(s, bridge);
    remember(s, woking);
    forget(s, bridge);
    expect(recentSpots(s)).toEqual([woking]);
  });

  it("carries over the one spot the page kept before the list", () => {
    const s = store({ [OLD]: "name=Our+bridge&a=BKO&b=WOK&f=0.52&an=Brookwood&bn=Woking" });
    expect(recentSpots(s)).toEqual([bridge]);
    remember(s, woking);
    expect(recentSpots(s)).toEqual([woking, bridge]);
  });

  it("doesn't bring the old spot back once it's been forgotten", () => {
    const s = store({ [OLD]: "name=Woking&a=WOK&an=Woking" });
    forget(s, woking);
    expect(recentSpots(s)).toEqual([]);
  });

  it("ignores what it can't read", () => {
    expect(recentSpots(store({ [RECENT]: "not json" }))).toEqual([]);
    expect(recentSpots(store({ [RECENT]: JSON.stringify(["a=bad code", 7, "name=Woking&a=WOK&an=Woking"]) }))).toEqual([woking]);
  });

  it("gets by when storage is blocked", () => {
    const blocked = {
      getItem: (): string | null => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(recentSpots(blocked)).toEqual([]);
    expect(remember(blocked, bridge)).toEqual([bridge]);
  });
});
