// Where each place is on the map, for finding one there (find-on-map). RTT's lists have no
// coordinates, so they come from NaPTAN, the Department for Transport's open list of stops: its
// rail stations are 9100<TIPLOC>, with a latitude and longitude. Made small at deploy time by
// compactPoints, keyed by the code the place list (places.ts) uses. Junctions aren't in NaPTAN:
// they come from a kept copy of Network Rail's BPLAN (bplan.ts).
// See docs/how-it-works.md#setting-up-a-spot.

import type { Places, RttLocation } from "./places.ts";

/** A rail station from NaPTAN. */
export interface NaptanStation {
  tiploc: string;
  name: string;
  lat: number;
  lon: number;
}

/** The list as made: [code, latitude, longitude], the code as in the place list (a station's CRS, a timing point's TIPLOC). */
export interface Points {
  v: 1;
  points: [string, number, number][];
}

/**
 * The list as shipped (points.json), made small for the page: in columns, sorted south to north,
 * each place in ten-thousandths of a degree (about 10 m, finer than BPLAN's 100 m) as a step from
 * the one before. 92 KB rather than 164 KB for 6,000 points (43 KB gzipped rather than 61).
 */
export interface PackedPoints {
  v: 2;
  /** The codes, joined with commas. */
  codes: string;
  lat: number[];
  lon: number[];
}

/** The shipped form of a list. */
export function packPoints(points: [string, number, number][]): PackedPoints {
  const sorted = [...points].sort((p, q) => p[1] - q[1] || p[0].localeCompare(q[0]));
  const lat: number[] = [];
  const lon: number[] = [];
  let y0 = 0;
  let x0 = 0;
  for (const [, y, x] of sorted) {
    const Y = Math.round(y * 1e4);
    const X = Math.round(x * 1e4);
    lat.push(Y - y0);
    lon.push(X - x0);
    [y0, x0] = [Y, X];
  }
  return { v: 2, codes: sorted.map((p) => p[0]).join(","), lat, lon };
}

/** The list back from its shipped form: what the page reads. */
export function unpackPoints(packed: PackedPoints): [string, number, number][] {
  const codes = packed.codes ? packed.codes.split(",") : [];
  let y = 0;
  let x = 0;
  return codes.map((c, i) => {
    y += packed.lat[i];
    x += packed.lon[i];
    return [c, y / 1e4, x / 1e4];
  });
}

/** A CSV's rows, each a list of fields: quoted fields may hold commas, doubled quotes and line breaks. */
function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") row.push(field), (field = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field), rows.push(row), (row = []), (field = "");
    } else field += c;
  }
  if (field || row.length) row.push(field), rows.push(row);
  return rows;
}

/** NaPTAN's rail stations, from its stops CSV (`/v1/access-nodes?dataFormat=csv&atcoAreaCodes=910`): active ones with a place. */
export function naptanStations(csv: string): NaptanStation[] {
  const [head = [], ...rows] = csvRows(csv);
  const at = (name: string) => head.indexOf(name);
  const [code, name, lat, lon, type, status] = ["ATCOCode", "CommonName", "Latitude", "Longitude", "StopType", "Status"].map(at);
  if ([code, name, lat, lon].some((i) => i < 0)) return [];
  const out: NaptanStation[] = [];
  for (const f of rows) {
    if (!f[code]?.startsWith("9100") || (type >= 0 && f[type] !== "RLY") || (status >= 0 && f[status] !== "active")) continue;
    const y = Number(f[lat]);
    const x = Number(f[lon]);
    if (!f[lat] || !f[lon] || !Number.isFinite(y) || !Number.isFinite(x)) continue;
    out.push({ tiploc: f[code].slice(4).toUpperCase(), name: f[name].replace(/[\s,]+(Rail|Railway|Train) Station$/i, "").trim(), lat: y, lon: x });
  }
  return out;
}

/** Lower case, letters and digits only: how names are matched when the codes don't. */
const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * The small list to ship: a place for each station in the place list that NaPTAN has, found by
 * its TIPLOC (RTT's locations give each station's TIPLOC beside its CRS), else by its name when
 * only one of RTT's stations has it and NaPTAN's stations of that name are all within a kilometre
 * (one station's several rows, as at Clapham Junction): two Newports never trade places. Then
 * BPLAN's timing points (bplan.ts), by TIPLOC: the junctions and others, and any station NaPTAN
 * missed; NaPTAN wins for a station. BPLAN's grid references are often wrong for small points
 * (Barnes Signal W1090 is 700 km from Barnes, some lie in the sea), so one is kept only if it's
 * within 5 km of the station it's named after (Woking Jn by Woking), else within 15 km of any
 * station NaPTAN placed. In the 2024 BPLAN, of the points named after somewhere, 1,452 were within
 * 5 km of it, 23 more by 15 km, and the rest mostly hundreds of km out; a remote line's points can
 * be 15 km from a station (Beattock Summit). These only catch gross errors: BPLAN rounds most grid
 * references to 100 m. Rounded to 5 places of decimals, about a metre.
 */
export function compactPoints(stations: NaptanStation[], locations: RttLocation[], places: Places, timingPoints: [string, number, number][] = []): Points & { dropped: string[] } {
  const crsOf = new Map<string, string>();
  for (const l of locations) if (l.longCode && l.shortCode) crsOf.set(l.longCode.toUpperCase(), l.shortCode.toUpperCase());
  const station = new Set(places.stations.map(([, c]) => c));
  const other = new Set(places.others.map(([, c]) => c));
  const byName = new Map<string, string | null>();
  for (const [n, c] of places.stations) byName.set(fold(n), byName.has(fold(n)) ? null : c);
  const round = (x: number) => Math.round(x * 1e5) / 1e5;
  const found = new Map<string, [number, number]>();
  // By code first, so a name never takes a place that a code has.
  for (const s of stations) {
    const crs = crsOf.get(s.tiploc);
    const code = crs && station.has(crs) ? crs : other.has(s.tiploc) ? s.tiploc : undefined;
    if (code && !found.has(code)) found.set(code, [round(s.lat), round(s.lon)]);
  }
  const naptanByName = new Map<string, NaptanStation[]>();
  for (const s of stations) naptanByName.set(fold(s.name), [...(naptanByName.get(fold(s.name)) ?? []), s]);
  // About a kilometre, in degrees: close enough for one station's rows, too close for two towns.
  const near = (p: NaptanStation, q: NaptanStation) => Math.abs(p.lat - q.lat) < 0.01 && Math.abs(p.lon - q.lon) < 0.015;
  for (const [n, same] of naptanByName) {
    const code = byName.get(n);
    if (!code || found.has(code) || !same.every((s) => near(s, same[0]))) continue;
    found.set(code, [round(same[0].lat), round(same[0].lon)]);
  }
  // The stations NaPTAN placed, by name, to check BPLAN's points against.
  const placed = places.stations.filter(([, c]) => found.has(c)).map(([n, c]) => ({ words: fold(n).split(" "), at: found.get(c)! }));
  const nameOf = new Map(places.others.map(([n, c]) => [c, n]));
  const dropped: string[] = [];
  for (const [tiploc, lat, lon] of timingPoints) {
    const crs = crsOf.get(tiploc);
    const code = crs && station.has(crs) ? crs : other.has(tiploc) ? tiploc : undefined;
    if (!code || found.has(code)) continue;
    const at: [number, number] = [lat, lon];
    const words = fold(nameOf.get(code) ?? "").split(" ");
    // The station it's named after: the one whose whole name starts its name, the longest; if
    // several have that name (two Newports), being near any of them will do.
    const starts = placed.filter((p) => p.words.length < words.length && p.words.every((w, i) => w === words[i]));
    const longest = Math.max(0, ...starts.map((p) => p.words.length));
    const namesakes = starts.filter((p) => p.words.length === longest);
    const ok = namesakes.length ? namesakes.some((p) => km(p.at, at) <= NAMESAKE_KM) : placed.some((p) => km(p.at, at) <= ANY_STATION_KM);
    if (ok) found.set(code, [round(lat), round(lon)]);
    else dropped.push(code);
  }
  return { dropped, v: 1, points: [...found].map(([c, [y, x]]) => [c, y, x] as [string, number, number]).sort((p, q) => p[0].localeCompare(q[0])) };
}

/**
 * How far a BPLAN point may be from the station it's named after, and from any station when it
 * isn't. A point past these is left out of the map: when one is missing, look here first (the
 * deploy's log lists them; docs/how-it-works.md, "If a point is missing from the map").
 */
export const NAMESAKE_KM = 5;
export const ANY_STATION_KM = 15;

/** Roughly how far apart two places are, in kilometres: near enough at the scale of Great Britain. */
const km = (p: [number, number], q: [number, number]) => Math.hypot((p[0] - q[0]) * 111.2, (p[1] - q[1]) * 111.2 * Math.cos((p[0] * Math.PI) / 180));

/** The most the shipped list may weigh: about twice what 2,600 stations and 3,000 timing points take, packed. */
export const POINTS_MAX_BYTES = 250_000;
/** The fewest stations a list fit to ship has: there are about 2,600. */
export const POINTS_MIN = 1_000;

/** Great Britain and its islands, with a margin: a point outside isn't where it says. */
const GB = { south: 49.8, north: 60.9, west: -8.7, east: 1.8 };

/** What's wrong with a points list, as shipped (packed): nothing, if it's fit for the page. */
export function pointsProblems(json: string, min = POINTS_MIN): string[] {
  if (json.length > POINTS_MAX_BYTES) return [`${Math.round(json.length / 1024)} KB, over ${POINTS_MAX_BYTES / 1000} KB`];
  let p: Partial<PackedPoints>;
  try {
    p = JSON.parse(json);
  } catch {
    return ["not JSON"];
  }
  if (p.v !== 2) return [`version ${String(p.v)}, not 2`];
  if (typeof p.codes !== "string" || !Array.isArray(p.lat) || !Array.isArray(p.lon)) return ["not { codes, lat, lon }"];
  const codes = p.codes ? p.codes.split(",") : [];
  if (p.lat.length !== codes.length || p.lon.length !== codes.length) return [`${codes.length} codes but ${p.lat.length} latitudes and ${p.lon.length} longitudes`];
  if (![...p.lat, ...p.lon].every((n) => Number.isInteger(n))) return ["a step isn't a whole number"];
  const problems: string[] = [];
  if (codes.length < min) problems.push(`only ${codes.length} points, fewer than ${min}`);
  const badCode = codes.find((c) => !/^[A-Z0-9]{3,7}$/.test(c));
  if (badCode !== undefined) problems.push(`a code isn't a CRS or TIPLOC: ${JSON.stringify(badCode)}`);
  const away = unpackPoints(p as PackedPoints).find(([, y, x]) => y < GB.south || y > GB.north || x < GB.west || x > GB.east);
  if (away) problems.push(`${away[0]} is outside Great Britain (${away[1]}, ${away[2]})`);
  return problems;
}
