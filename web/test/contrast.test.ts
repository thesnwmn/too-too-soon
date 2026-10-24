import { describe, expect, it } from "vitest";
import css from "../src/style.css?raw";

// The countdown is read in sunlight at arm's length: its yellow on green (and on the freight
// colour) stays at 7:1 or more (WCAG AAA), light and dark.
const vars = (block: string) => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
const light = vars(css.slice(css.indexOf(":root"), css.indexOf("@media (prefers-color-scheme: dark)")));
const dark = { ...light, ...vars(css.slice(css.indexOf("@media (prefers-color-scheme: dark)")).split(/\n}\n/)[0]) };

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("the countdown's contrast", () => {
  it("knows black on white is 21:1", () => expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 1));
  for (const [mode, v] of [["light", light], ["dark", dark]] as const) {
    it(`is 7:1 or more on the passenger and freight colours, ${mode}`, () => {
      expect(contrast(v["accent-ink"], v.accent)).toBeGreaterThanOrEqual(7);
      expect(contrast(v["accent-ink"], v.freight)).toBeGreaterThanOrEqual(7);
      expect(contrast(v.smoke, v.accent)).toBeGreaterThanOrEqual(7);
    });
  }
});
