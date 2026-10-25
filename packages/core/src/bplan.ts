// Where junctions and other timing points are, from Network Rail's BPLAN (the Geography file,
// Open Government Licence). NaPTAN (points.ts) has only stations. BPLAN needs an account to
// download, so the producer downloads one now and then, `scripts/bplan.mjs` keeps a small copy
// in packages/core/data/bplan-points.json, and the deploy joins it into points.json.
// See docs/how-it-works.md#setting-up-a-spot.

/** The kept copy: [TIPLOC, latitude, longitude], and which BPLAN it came from. */
export interface BplanPoints {
  v: 1;
  /** The BPLAN file's own header: its dates, as "02-06-2024 to 14-12-2024, made 24-05-2024". */
  source: string;
  points: [string, number, number][];
}

const rad = Math.PI / 180;

/** Great Britain and its islands, with a margin, as points.ts has it. */
const GB = { south: 49.8, north: 60.9, west: -8.7, east: 1.8 };

/**
 * An Ordnance Survey grid reference (easting, northing in metres, OSGB36) as WGS84 latitude and
 * longitude: the inverse transverse Mercator on the Airy 1830 ellipsoid, then a Helmert
 * transform. Good to about a metre against NaPTAN's own conversions; BPLAN's grid references are
 * coarser (most to 100 m, so a place can be 100 to 150 m out before any conversion).
 */
export function osgbToLatLon(easting: number, northing: number): { lat: number; lon: number } {
  // The National Grid's projection.
  const a = 6377563.396;
  const b = 6356256.909;
  const F0 = 0.9996012717;
  const lat0 = 49 * rad;
  const lon0 = -2 * rad;
  const N0 = -100000;
  const E0 = 400000;
  const e2 = 1 - (b * b) / (a * a);
  const n = (a - b) / (a + b);
  const meridian = (phi: number) =>
    b *
    F0 *
    ((1 + n + (5 / 4) * n ** 2 + (5 / 4) * n ** 3) * (phi - lat0) -
      (3 * n + 3 * n ** 2 + (21 / 8) * n ** 3) * Math.sin(phi - lat0) * Math.cos(phi + lat0) +
      ((15 / 8) * n ** 2 + (15 / 8) * n ** 3) * Math.sin(2 * (phi - lat0)) * Math.cos(2 * (phi + lat0)) -
      (35 / 24) * n ** 3 * Math.sin(3 * (phi - lat0)) * Math.cos(3 * (phi + lat0)));
  let phi = lat0;
  let M = 0;
  do {
    phi = (northing - N0 - M) / (a * F0) + phi;
    M = meridian(phi);
  } while (Math.abs(northing - N0 - M) >= 0.00001);
  const sin = Math.sin(phi);
  const cos = Math.cos(phi);
  const tan = Math.tan(phi);
  const nu = (a * F0) / Math.sqrt(1 - e2 * sin * sin);
  const rho = (a * F0 * (1 - e2)) / (1 - e2 * sin * sin) ** 1.5;
  const eta2 = nu / rho - 1;
  const VII = tan / (2 * rho * nu);
  const VIII = (tan / (24 * rho * nu ** 3)) * (5 + 3 * tan ** 2 + eta2 - 9 * tan ** 2 * eta2);
  const IX = (tan / (720 * rho * nu ** 5)) * (61 + 90 * tan ** 2 + 45 * tan ** 4);
  const X = 1 / (cos * nu);
  const XI = (1 / (cos * 6 * nu ** 3)) * (nu / rho + 2 * tan ** 2);
  const XII = (1 / (cos * 120 * nu ** 5)) * (5 + 28 * tan ** 2 + 24 * tan ** 4);
  const XIIA = (1 / (cos * 5040 * nu ** 7)) * (61 + 662 * tan ** 2 + 1320 * tan ** 4 + 720 * tan ** 6);
  const dE = easting - E0;
  const lat = phi - VII * dE ** 2 + VIII * dE ** 4 - IX * dE ** 6;
  const lon = lon0 + X * dE - XI * dE ** 3 + XII * dE ** 5 - XIIA * dE ** 7;

  // OSGB36 to WGS84: to cartesian on Airy, a Helmert transform, back on GRS80.
  const nuA = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  const x1 = nuA * Math.cos(lat) * Math.cos(lon);
  const y1 = nuA * Math.cos(lat) * Math.sin(lon);
  const z1 = nuA * (1 - e2) * Math.sin(lat);
  const s = -20.4894e-6;
  const [rx, ry, rz] = [0.1502, 0.247, 0.8421].map((sec) => (sec / 3600) * rad);
  const x2 = 446.448 + (1 + s) * x1 - rz * y1 + ry * z1;
  const y2 = -125.157 + rz * x1 + (1 + s) * y1 - rx * z1;
  const z2 = 542.06 - ry * x1 + rx * y1 + (1 + s) * z1;
  const a2 = 6378137;
  const b2 = 6356752.3141;
  const e22 = 1 - (b2 * b2) / (a2 * a2);
  const p = Math.hypot(x2, y2);
  let phi2 = Math.atan2(z2, p * (1 - e22));
  for (let i = 0; i < 10; i++) phi2 = Math.atan2(z2 + (e22 * a2 * Math.sin(phi2)) / Math.sqrt(1 - e22 * Math.sin(phi2) ** 2), p);
  return { lat: phi2 / rad, lon: Math.atan2(y2, x2) / rad };
}

/**
 * The kept copy, from BPLAN's text: each LOC record (tab separated: LOC, action, TIPLOC, name,
 * start date, end date, easting, northing, …) still in use, with a real grid reference: BPLAN
 * writes 0, 1, 666666 or 999999 for none, and some are simply wrong, so any outside Great Britain
 * are left out (the deploy checks the rest against the stations). Rounded to 5 places of decimals.
 */
export function bplanPoints(text: string): BplanPoints {
  const round = (x: number) => Math.round(x * 1e5) / 1e5;
  const lines = text.split(/\r?\n/);
  const head = lines.find((l) => l.startsWith("PIF"))?.split("\t") ?? [];
  const day = (s: string | undefined) => s?.split(" ")[0] ?? "?";
  const source = head.length ? `${day(head[4])} to ${day(head[5])}, made ${day(head[8])}` : "unknown";
  const starts = dmy(head[4]);
  const found = new Map<string, [number, number]>();
  for (const line of lines) {
    if (!line.startsWith("LOC\t")) continue;
    const f = line.split("\t");
    const tiploc = f[2]?.trim().toUpperCase();
    const e = Number(f[6]);
    const n = Number(f[7]);
    // An end date before the file's own start means it's gone; one later is still in use.
    const ended = dmy(f[5]);
    if (!tiploc || !/^[A-Z0-9]{3,7}$/.test(tiploc) || f[1] === "D" || (ended !== undefined && (starts === undefined || ended < starts))) continue;
    if (!(e > 0 && e < 700000 && n > 0 && n < 1250000)) continue;
    const { lat, lon } = osgbToLatLon(e, n);
    if (lat < GB.south || lat > GB.north || lon < GB.west || lon > GB.east) continue;
    found.set(tiploc, [round(lat), round(lon)]);
  }
  return { v: 1, source, points: [...found].map(([c, [y, x]]) => [c, y, x] as [string, number, number]).sort((p, q) => p[0].localeCompare(q[0])) };
}

/** "14-12-2024 23:59:59" (BPLAN's dates) as epoch milliseconds; undefined if blank. */
const dmy = (s: string | undefined) => {
  const m = s?.match(/(\d{2})-(\d{2})-(\d{4})/);
  return m ? Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : undefined;
};

/** The most the kept copy may weigh: about twice what 6,300 points take. */
export const BPLAN_MAX_BYTES = 400_000;
/** The fewest points a kept copy fit to use has: the 2024 file had 6,302. */
export const BPLAN_MIN = 3_000;

/** What's wrong with the kept copy: nothing, if it's fit to join into points.json. */
export function bplanProblems(json: string, min = BPLAN_MIN): string[] {
  if (json.length > BPLAN_MAX_BYTES) return [`${Math.round(json.length / 1024)} KB, over ${BPLAN_MAX_BYTES / 1000} KB`];
  let p: Partial<BplanPoints>;
  try {
    p = JSON.parse(json);
  } catch {
    return ["not JSON"];
  }
  const problems: string[] = [];
  if (p.v !== 1) problems.push(`version ${String(p.v)}, not 1`);
  if (typeof p.source !== "string" || !p.source) problems.push("no source");
  if (!Array.isArray(p.points)) return [...problems, "no points"];
  if (p.points.length < min) problems.push(`only ${p.points.length} points, fewer than ${min}`);
  const bad = p.points.find((x) => !Array.isArray(x) || x.length !== 3 || typeof x[0] !== "string" || !/^[A-Z0-9]{3,7}$/.test(x[0]) || typeof x[1] !== "number" || typeof x[2] !== "number");
  if (bad) problems.push(`a point isn't [TIPLOC, lat, lon]: ${JSON.stringify(bad)}`);
  const away = p.points.find((x) => Array.isArray(x) && typeof x[1] === "number" && typeof x[2] === "number" && (x[1] < GB.south || x[1] > GB.north || x[2] < GB.west || x[2] > GB.east));
  if (away) problems.push(`${away[0]} is outside Great Britain (${away[1]}, ${away[2]})`);
  return problems;
}

/** When the kept copy's BPLAN ran to ("14-12-2024" in its source), as epoch milliseconds; undefined if it doesn't say. */
export function bplanEnds(source: string): number | undefined {
  return dmy(source.match(/to (\d{2}-\d{2}-\d{4})/)?.[1]);
}
