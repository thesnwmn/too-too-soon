// Asks the live Worker /api/info and /api/next, and says what came back: run by probe.yml.
// With PLACE (a map link or "lat,lon"), first finds the spot's timing points from OpenStreetMap,
// with the same `locate` the map picker uses.
import { appendFileSync } from "node:fs";
import { distance, locate, overpassQuery } from "../../packages/core/src/locate.ts";

/** Coordinates from "lat,lon" or a Google Maps link, following a short link's redirects. */
async function coordinates(place) {
  const pair = place.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (pair && !/^https?:/.test(place.trim())) return { lat: Number(pair[1]), lon: Number(pair[2]) };
  const r = await fetch(place.trim(), { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } });
  const text = `${r.url} ${await r.text()}`;
  // A pin is !3d<lat>!4d<lon>; a view is @lat,lon; a search is ?q=lat,lon.
  const m = text.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ?? text.match(/[@=](-?\d{1,2}\.\d{3,}),(-?\d{1,3}\.\d{3,})/);
  if (!m) throw new Error(`no coordinates in ${r.url}`);
  return { lat: Number(m[1]), lon: Number(m[2]) };
}

const spotLines = [];
if (process.env.PLACE) {
  const at = await coordinates(process.env.PLACE);
  spotLines.push(`**Place:** ${at.lat.toFixed(5)}, ${at.lon.toFixed(5)} (https://www.openstreetmap.org/?mlat=${at.lat}&mlon=${at.lon}#map=17/${at.lat}/${at.lon})`);
  console.log(spotLines[0]);
  // Public Overpass servers rate-limit shared runners: try each, a few times, with a pause.
  const servers = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
  const overpass = async (data) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      for (const url of servers) {
        // overpass-api.de turns away requests that don't say who they are (406).
        const t0 = Date.now();
        const r = await fetch(url, { method: "POST", body: new URLSearchParams({ data }), headers: { "User-Agent": "too-too-soon-probe/1 (+https://github.com/thesnwmn/too-too-soon)", Accept: "application/json" } }).catch(() => undefined);
        const text = r ? await r.text() : "";
        console.log(`${url}: ${r?.status ?? "no answer"} in ${((Date.now() - t0) / 1000).toFixed(1)} s, ${Math.round(text.length / 1024)} KB`);
        if (r?.ok && text.startsWith("{")) return JSON.parse(text).elements ?? [];
      }
      await new Promise((res) => setTimeout(res, 15_000));
    }
    throw new Error("Overpass stayed busy");
  };
  let found;
  let elements = [];
  for (const radius of [3000, 8000]) {
    elements = await overpass(overpassQuery(at.lat, at.lon, radius));
    found = locate(elements, at);
    if (found) break;
  }
  if (!found) {
    // Say why: how far the nearest running line is, and which timing points are about.
    const ways = elements.filter((e) => e.type === "way");
    let near;
    for (const w of ways) for (const p of w.geometry ?? []) {
      const d = distance(at, p);
      if (!near || d < near.d) near = { d, tags: w.tags ?? {} };
    }
    const tiplocs = elements
      .filter((e) => e.type === "node")
      .map((n) => ({ code: n.tags?.["ref:tiploc"], name: n.tags?.name, d: distance(at, n) }))
      .sort((x, y) => x.d - y.d)
      .slice(0, 8);
    spotLines.push(
      "",
      "No running line with timing points either side within 200 m of that place.",
      `${ways.length} running-line ways within 8 km; the nearest track point is ${near ? `${Math.round(near.d)} m away (${JSON.stringify(near.tags)})` : "none"}.`,
      `Nearest timing points: ${tiplocs.map((t) => `${t.code} ${t.name ?? ""} ${Math.round(t.d)} m`).join("; ") || "none"}`,
    );
    console.log(spotLines.join("\n"));
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, spotLines.join("\n") + "\n");
    process.exit(0);
  }
  const round = (m) => `${Math.round(m)} m`;
  spotLines.push(`**Spot:** ${round(found.offTrack)} from the track; A ${found.a.code} (${found.a.name}, ${round(found.a.along)} along the track), B ${found.b.code} (${found.b.name}, ${round(found.b.along)}), f ${found.f.toFixed(2)}`, "");
  process.env.A = found.a.code;
  process.env.B = found.b.code;
  process.env.F = found.f.toFixed(2);
  process.env.SPOT_LINK = new URLSearchParams({ name: "Our bridge", a: found.a.code, b: found.b.code, f: found.f.toFixed(2), an: found.a.name, bn: found.b.name }).toString();
}

const site = (process.env.SITE || "").replace(/\/$/, "");
if (!site) {
  console.log("::error::No site: give the url input, or set the SITE_URL secret in the production environment.");
  process.exit(1);
}
const q = new URLSearchParams({ a: process.env.A ?? "", b: process.env.B ?? "", f: process.env.F ?? "0.5" });
const get = async (path) => {
  const r = await fetch(`${site}${path}`);
  const text = await r.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 300);
  }
  return { status: r.status, body };
};

const info = await get("/api/info");
const next = await get(`/api/next?${q}`);
const clock = (t) => new Date(t).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
const lines = [`## Probe of ${site}`, "", ...spotLines, ...(process.env.SPOT_LINK ? [`**Link:** ${site}/?${process.env.SPOT_LINK}`, ""] : []), "**/api/info**", "", "```json", JSON.stringify(info, null, 2), "```", "", `**/api/next?${q}**: ${next.status}`, ""];
const passes = next.body?.passes;
if (Array.isArray(passes)) {
  lines.push(`${passes.length} trains between ${next.body.aName ?? q.get("a")} and ${next.body.bName ?? q.get("b")}${next.body.stale ? " (stale)" : ""}${next.body.limited ? " (live data limited)" : ""}:`, "");
  lines.push("| time | dir | headcode | what | class | operator | from | basis | late | stops |", "|---|---|---|---|---|---|---|---|---|---|");
  for (const p of passes.slice(0, 25))
    lines.push(`| ${clock(p.time)} | ${p.direction} | ${p.headcode ?? ""} | ${p.passenger ? `${p.coaches ?? "?"} coaches to ${p.destination ?? "?"}` : "freight/ECS"} | ${p.trainClass ?? ""} | ${p.operator ?? ""} | ${p.origin ?? ""} | ${p.basis} | ${p.late ?? ""} | ${[p.stopsBefore && "before", p.stopsAfter && "after"].filter(Boolean).join(", ") || "non-stop"} |`);
} else lines.push("```json", JSON.stringify(next.body, null, 2), "```");
const out = lines.join("\n");
console.log(out);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, out + "\n");
