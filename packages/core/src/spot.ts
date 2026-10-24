// A spot: where you watch from, as the two timing points either side and how far along
// from A to B it is. It travels in the URL, so a spot is a link you can bookmark.
import { isLocationCode } from "./passes.ts";

export interface Spot {
  name: string;
  /** The timing points either side, as RTT codes (TIPLOCs or CRS codes). With no B, the spot is A itself: a one-point spot. */
  a: string;
  b?: string;
  /** How far along the track from A to B the spot is, 0 to 1 (0 for a one-point spot). */
  f: number;
  /** What to call each direction: "towards <name>". Defaults to the codes. */
  aName?: string;
  bName?: string;
}

/** A spot from URL parameters, or what's wrong with them. With no "b", a one-point spot: the trains at "a". */
export function parseSpot(params: URLSearchParams): { spot: Spot } | { error: string } {
  const a = (params.get("a") ?? "").trim().toUpperCase();
  const b = (params.get("b") ?? "").trim().toUpperCase();
  const fRaw = params.get("f");
  const f = fRaw === null || fRaw === "" ? 0.5 : Number(fRaw);
  const text = (k: string) => params.get(k)?.trim().slice(0, 60) || undefined;
  if (!isLocationCode(a)) return { error: `"a" should be a timing point code (TIPLOC), like CLPHMJN` };
  if (!b) return { spot: { name: text("name") ?? text("an") ?? a, a, f: 0, aName: text("an") } };
  if (!isLocationCode(b)) return { error: `"b" should be a timing point code (TIPLOC), like CLPHMJN` };
  if (a === b) return { error: `"a" and "b" should be different timing points` };
  if (!Number.isFinite(f) || f < 0 || f > 1) return { error: `"f" should be a number from 0 to 1` };
  return { spot: { name: text("name") ?? `${a} – ${b}`, a, b, f, aName: text("an"), bName: text("bn") } };
}

/** The URL parameters for a spot: the inverse of parseSpot. A one-point spot has no b and no f. */
export function spotParams(spot: Spot): URLSearchParams {
  const p = new URLSearchParams({ name: spot.name, a: spot.a });
  if (spot.b) {
    p.set("b", spot.b);
    p.set("f", String(Math.round(spot.f * 1000) / 1000));
  }
  if (spot.aName) p.set("an", spot.aName);
  if (spot.b && spot.bName) p.set("bn", spot.bName);
  return p;
}
