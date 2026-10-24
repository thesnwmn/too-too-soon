import { describe, expect, it } from "vitest";
import type { Places } from "@too-too-soon/core";
import { resolvePlace } from "../src/places.ts";

const list: Places = { v: 1, stations: [["Bath Spa", "BTH"], ["Hook", "HOK"], ["Woking", "WOK"]], others: [["Woking Jn", "WOKINGJ"]] };
const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

describe("resolvePlace", () => {
  it("takes the place picked", () => expect(resolvePlace(form({ a: "WOK", an: "Woking", aq: "Woking" }), "a", list)).toEqual({ code: "WOK", name: "Woking" }));
  it("takes a name typed in full, or a code, from the list", () => {
    expect(resolvePlace(form({ aq: "hook" }), "a", list)).toEqual({ code: "HOK", name: "Hook" });
    expect(resolvePlace(form({ bq: "wokingj" }), "b", list)).toEqual({ code: "WOKINGJ", name: "Woking Jn" });
  });
  it("won't send a word as a code when there's a list to check it against", () => expect(resolvePlace(form({ aq: "Bath" }), "a", list)).toEqual({}));
  it("takes a code typed in capitals that the list doesn't have", () => expect(resolvePlace(form({ aq: "CLPHMJC" }), "a", list)).toEqual({ code: "CLPHMJC" }));
  it("takes anything code-shaped when there's no list", () => {
    expect(resolvePlace(form({ aq: "clphmjn" }), "a")).toEqual({ code: "CLPHMJN" });
    expect(resolvePlace(form({ aq: "somewhere odd" }), "a")).toEqual({});
  });
});
