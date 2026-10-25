import { describe, expect, it } from "vitest";
import { fillDraft } from "../src/fill.ts";

const form = { mode: "two", a: "WOK", an: "Woking", aq: "Woking", b: "", bn: "", bq: "", f: "0.52", name: "Our bridge" };

describe("fillDraft", () => {
  it("fills the box Find on map was opened for, and keeps the rest of the form", () => {
    expect(fillDraft(form, { box: "b", code: "BKO", name: "Brookwood" })).toEqual({ ...form, b: "BKO", bn: "Brookwood", bq: "Brookwood" });
  });
  it("'Use as the one place' fills A and sets One place", () => {
    expect(fillDraft(form, { box: "a", code: "WOKINGJ", name: "Woking Jn", mode: "one" })).toMatchObject({ mode: "one", a: "WOKINGJ", an: "Woking Jn", name: "Our bridge" });
  });
  it("'Use as A' and 'Use as B' set Between two", () => {
    const one = { mode: "one", a: "WOK", an: "Woking", aq: "Woking" };
    expect(fillDraft(one, { box: "a", code: "BKO", name: "Brookwood", mode: "two" })).toMatchObject({ mode: "two", a: "BKO" });
    expect(fillDraft(one, { box: "b", code: "BKO", name: "Brookwood", mode: "two" })).toMatchObject({ mode: "two", a: "WOK", b: "BKO" });
  });
  it("with no form yet, A means one place and B means two", () => {
    expect(fillDraft(undefined, { box: "a", code: "WOK", name: "Woking" }).mode).toBe("one");
    expect(fillDraft(undefined, { box: "b", code: "BKO", name: "Brookwood" }).mode).toBe("two");
  });
});
