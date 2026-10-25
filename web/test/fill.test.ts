import { describe, expect, it } from "vitest";
import { autoName, autoOn, fillDraft, tapDraft } from "../src/fill.ts";

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

describe("auto-name", () => {
  const tap = { a: "WOK", b: "BKO", f: 0.3, aName: "Woking", bName: "Brookwood", road: "Hermitage Road bridge" };

  it("one place is named after it", () => {
    expect(fillDraft(undefined, { box: "a", code: "WOK", name: "Woking" }).name).toBe("Woking");
  });

  it("between two picked by name is Between A and B, once both are picked", () => {
    const a = fillDraft({ mode: "two" }, { box: "a", code: "WOK", name: "Woking" });
    expect(a.name).toBe("");
    expect(fillDraft(a, { box: "b", code: "BKO", name: "Brookwood" }).name).toBe("Between Woking and Brookwood");
  });

  it("a tap on the track is named after the road there, and Between A and B without one", () => {
    expect(tapDraft(undefined, tap).name).toBe("Hermitage Road bridge");
    expect(tapDraft(undefined, { ...tap, road: undefined }).name).toBe("Between Woking and Brookwood");
  });

  it("the road holds through Swap and a nudge of the slider, and gives way when the places or the slider move", () => {
    const d = tapDraft(undefined, tap);
    expect(autoName({ ...d, a: "BKO", b: "WOK", an: "Brookwood", bn: "Woking", f: "0.7" })).toBe("Hermitage Road bridge");
    expect(autoName({ ...d, f: "0.32" })).toBe("Hermitage Road bridge");
    expect(autoName({ ...d, f: "0.6" })).toBe("Between Woking and Brookwood");
    expect(autoName({ ...d, b: "WOKINGJ", bn: "Woking Jn" })).toBe("Between Woking and Woking Jn");
    expect(autoName({ ...d, mode: "one" })).toBe("Woking");
  });

  it("a typed name is never written over", () => {
    const typed = { ...tapDraft(undefined, tap), name: "Our bridge", auto: "0" };
    expect(fillDraft(typed, { box: "b", code: "WOKINGJ", name: "Woking Jn" }).name).toBe("Our bridge");
    expect(tapDraft(typed, { ...tap, road: "Other Road" }).name).toBe("Our bridge");
    // A saved spot's own name is kept; one that's the made-up name keeps following.
    expect(autoOn({ mode: "two", a: "WOK", b: "BKO", an: "Woking", bn: "Brookwood", name: "Our bridge" })).toBe(false);
    expect(autoOn({ mode: "two", a: "WOK", b: "BKO", an: "Woking", bn: "Brookwood", name: "Between Woking and Brookwood" })).toBe(true);
  });
});
