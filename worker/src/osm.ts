// /api/osm: the map picker's OpenStreetMap lookup, asked from here rather than the phone.
// Public Overpass servers turn away requests that don't say who they are and rate-limit busy
// connections, and a browser sees either as a bare "Failed to fetch" (the error page has no
// CORS headers). From the Worker the request says who it is, a busy server falls through to
// the next, and the answer streams back untouched (parsing it would cost CPU the free plan
// doesn't have). Only our own query, built from lat, lon and radius, is ever sent.
import { overpassQuery } from "@too-too-soon/core";

export const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
/** How long each server gets before the next is tried: a busy one can take minutes. */
export const PER_SERVER_MS = 25_000;
const AGENT = "too-too-soon/1 (+https://github.com/thesnwmn/too-too-soon)";
const RADII = [3000, 8000];

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

export async function osm(url: URL, fetcher: typeof fetch): Promise<Response> {
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  const radius = Number(url.searchParams.get("radius"));
  // Great Britain, give or take, and only the radii the picker uses.
  if (!(lat > 49 && lat < 61 && lon > -9 && lon < 3) || !RADII.includes(radius)) return json({ error: "lat, lon (in Great Britain) and radius (3000 or 8000) please" }, 400);
  const body = new URLSearchParams({ data: overpassQuery(lat, lon, radius) });
  let last = 0;
  for (const server of OVERPASS) {
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), PER_SERVER_MS);
    const r = await fetcher(server, { method: "POST", body, headers: { "User-Agent": AGENT, Accept: "application/json" }, signal: stop.signal })
      .catch(() => undefined)
      .finally(() => clearTimeout(timer));
    if (r?.ok && (r.headers.get("Content-Type") ?? "").includes("json")) {
      return new Response(r.body, { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
    }
    last = r?.status ?? 0;
  }
  // Every server busy, slow or down: 503, which the picker shows as "busy".
  return json({ error: "OpenStreetMap is busy", status: last }, last === 429 ? 429 : 503);
}
