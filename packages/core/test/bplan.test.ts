import { describe, expect, it } from "vitest";
import { bplanEnds, bplanPoints, bplanProblems, osgbToLatLon } from "../src/bplan.ts";

describe("osgbToLatLon", () => {
  // NaPTAN gives both for each station: its grid reference and its latitude and longitude (2026-10-25).
  it("agrees with NaPTAN to within a metre", () => {
    for (const [e, n, lat, lon] of [
      [500660, 158695, 51.31846934954, -0.55695962081], // Woking
      [495200, 156954, 51.30375792694, -0.63574781605], // Brookwood
      [527205, 175500, 51.46418690022, -0.17022139909], // Clapham Junction
    ]) {
      const p = osgbToLatLon(e, n);
      expect(Math.abs(p.lat - lat)).toBeLessThan(0.00001);
      expect(Math.abs(p.lon - lon)).toBeLessThan(0.00001);
    }
  });
});

// BPLAN's Geography file, 2 June to 14 December 2024, as the producer sent it: the header and a few LOC records.
const bplan = [
  "PIF\t1\tCENTRE\tNR\t02-06-2024 00:00:00\t14-12-2024 23:59:59\tI\tD\t24-05-2024 19:00:46\t1",
  "REF\tA\tACC\t \tUndefined",
  "LOC\tA\tBRKWOOD\tBrookwood\t01-01-1995 00:00:00\t\t495200\t156900\tO\t3\t86041\tN\t ",
  "LOC\tA\tCLPHMJ1\tClapham Junction Plats 0-2\t11-12-2011 00:00:00\t\t0\t0\tM\t3\t87219\tN\t ",
  "LOC\tA\tCLPHMJN\tClapham Junction\t30-05-1999 00:00:00\t\t999999\t999999\tO\t3\t87219\tN\t ",
  "LOC\tA\tWOKING\tWoking\t01-01-1995 00:00:00\t\t500600\t158600\tT\t3\t86031\tN\t ",
  "LOC\tA\tWOKINGJ\tWoking Jn\t01-01-1995 00:00:00\t\t500313\t157872\tT\t3\t86040\tN",
  "LOC\tA\tACTNLRG\tActon Lane Rec Sdgs GBRf\t11-06-2006 00:00:00\t\t666666\t666666\tM\t5\t72209\tN\t ",
  "LOC\tA\tARDWTMD\tArdwick T.M.D.\t12-06-2005 00:00:00\t\t1\t1\tM\t5\t1\tN\t ",
  "LOC\tA\tALDMCE\tAldermaston Tip (CE)\t12-12-2004 00:00:00\t\t654747\t634463\tM\t5\t1\tN\t ",
  // Made up: a record that has ended, and one that ends after the file starts (still in use).
  "LOC\tA\tGONEJN\tGone Jn\t01-01-1995 00:00:00\t01-01-2020 00:00:00\t500000\t158000\tT\t3\t1\tN\t ",
  "LOC\tA\tSOONJN\tSoon Gone Jn\t01-01-1995 00:00:00\t01-09-2024 00:00:00\t500000\t158000\tT\t3\t1\tN\t ",
  "TLK\tA\tWOKING\tWOKINGJ\tUF\t ",
].join("\r\n");

describe("bplanPoints", () => {
  const kept = bplanPoints(bplan);
  it("says which BPLAN it came from", () => expect(kept.source).toBe("02-06-2024 to 14-12-2024, made 24-05-2024"));
  it("places each timing point with a real grid reference", () => {
    expect(kept.points).toEqual([
      ["BRKWOOD", 51.30327, -0.63576],
      ["SOONJN", 51.31234, -0.56662],
      ["WOKING", 51.31762, -0.55785],
      ["WOKINGJ", 51.31113, -0.56217],
    ]);
  });
  it("leaves out none (0, 999999), placeholders (1, 666666), ones outside Great Britain, and ended ones", () => {
    for (const code of ["CLPHMJ1", "CLPHMJN", "ACTNLRG", "ARDWTMD", "ALDMCE", "GONEJN"]) expect(kept.points.map((p) => p[0])).not.toContain(code);
  });
  it("puts a station within 150 m of NaPTAN's: BPLAN rounds to 100 m", () => {
    const metres = (p: number[], q: number[]) => Math.hypot((p[0] - q[0]) * 111_200, (p[1] - q[1]) * 111_200 * Math.cos((p[0] * Math.PI) / 180));
    const at = (code: string) => kept.points.find((p) => p[0] === code)!.slice(1) as number[];
    expect(metres(at("WOKING"), [51.31846934954, -0.55695962081])).toBeLessThan(150);
    expect(metres(at("BRKWOOD"), [51.30375792694, -0.63574781605])).toBeLessThan(150);
  });
  it("gives nothing for something that isn't BPLAN", () => expect(bplanPoints("<html>login</html>")).toEqual({ v: 1, source: "unknown", points: [] }));
});

describe("bplanProblems", () => {
  const many = (n: number) => ({ v: 1, source: "02-06-2024 to 14-12-2024, made 24-05-2024", points: Array.from({ length: n }, (_, i) => [`T${String(i).padStart(4, "0")}`, 51.3, -0.56]) });
  it("passes a copy fit to use", () => expect(bplanProblems(JSON.stringify(many(3500)))).toEqual([]));
  it("fails a copy with almost nothing, no source, or a point outside Great Britain", () => {
    expect(bplanProblems(JSON.stringify(many(40)))).toEqual(["only 40 points, fewer than 3000"]);
    expect(bplanProblems(JSON.stringify({ ...many(3500), source: "" }))).toEqual(["no source"]);
    const away = many(3500);
    away.points[9] = ["ACTNLRG", 55.8195, 2.25563];
    expect(bplanProblems(JSON.stringify(away))).toEqual(["ACTNLRG is outside Great Britain (55.8195, 2.25563)"]);
  });
  it("fails the wrong shape, or something far too big", () => {
    expect(bplanProblems("nope")).toEqual(["not JSON"]);
    expect(bplanProblems("x".repeat(500_000))[0]).toMatch(/over 400 KB/);
  });
});

describe("bplanEnds", () => {
  it("reads when the BPLAN ran to", () => expect(bplanEnds("02-06-2024 to 14-12-2024, made 24-05-2024")).toBe(Date.UTC(2024, 11, 14)));
  it("is undefined when the source doesn't say", () => expect(bplanEnds("unknown")).toBeUndefined());
});
