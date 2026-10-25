// Where each place is on the map, for finding one there (find-on-map). RTT's lists have no
// coordinates, so they come from NaPTAN, the Department for Transport's open list of stops: its
// rail stations are 9100<TIPLOC>, with a latitude and longitude. Made small at deploy time by
// compactPoints, keyed by the code the place list (places.ts) uses. Junctions aren't in NaPTAN.
// See docs/how-it-works.md#setting-up-a-spot.

import type { Places, RttLocation } from "./places.ts";

/** A rail station from NaPTAN. */
export interface NaptanStation {
  tiploc: string;
  name: string;
  lat: number;
  lon: number;
}

/** The shipped list: [code, latitude, longitude], the code as in the place list (a station's CRS, a timing point's TIPLOC). */
export interface Points {
  v: 1;
  points: [string, number, number][];
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
 * (one station's several rows, as at Clapham Junction): two Newports never trade places. Rounded to 5 places of decimals, about a metre.
 */
export function compactPoints(stations: NaptanStation[], locations: RttLocation[], places: Places): Points {
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
  return { v: 1, points: [...found].map(([c, [y, x]]) => [c, y, x] as [string, number, number]).sort((p, q) => p[0].localeCompare(q[0])) };
}

/** The most the shipped list may weigh: a few times what 2,600 stations take. */
export const POINTS_MAX_BYTES = 400_000;
/** The fewest stations a list fit to ship has: there are about 2,600. */
export const POINTS_MIN = 1_000;

/** Great Britain and its islands, with a margin: a point outside isn't where it says. */
const GB = { south: 49.8, north: 60.9, west: -8.7, east: 1.8 };

/** What's wrong with a points list, as shipped: nothing, if it's fit for the page. */
export function pointsProblems(json: string, min = POINTS_MIN): string[] {
  if (json.length > POINTS_MAX_BYTES) return [`${Math.round(json.length / 1024)} KB, over ${POINTS_MAX_BYTES / 1000} KB`];
  let p: Partial<Points>;
  try {
    p = JSON.parse(json);
  } catch {
    return ["not JSON"];
  }
  const problems: string[] = [];
  if (p.v !== 1) problems.push(`version ${String(p.v)}, not 1`);
  if (!Array.isArray(p.points)) return [...problems, "no points"];
  if (p.points.length < min) problems.push(`only ${p.points.length} points, fewer than ${min}`);
  const bad = p.points.find((x) => !Array.isArray(x) || x.length !== 3 || typeof x[0] !== "string" || !/^[A-Z0-9]{3,7}$/.test(x[0]) || typeof x[1] !== "number" || typeof x[2] !== "number");
  if (bad) problems.push(`a point isn't [code, lat, lon]: ${JSON.stringify(bad)}`);
  const away = p.points.find((x) => Array.isArray(x) && typeof x[1] === "number" && typeof x[2] === "number" && (x[1] < GB.south || x[1] > GB.north || x[2] < GB.west || x[2] > GB.east));
  if (away) problems.push(`${away[0]} is outside Great Britain (${away[1]}, ${away[2]})`);
  return problems;
}
