// Fetches RTT's stations and timing points and writes the small list the page searches
// (packages/core/src/places.ts): run by deploy.yml before the page is built, with the RTT_TOKEN
// secret, which never reaches the page. `node .github/scripts/places.mjs web/public/places.json`.
// If RTT can't be asked, it says so and writes nothing: the page then asks for codes instead.
// Then it writes points.json beside it, where each station is on the map (packages/core/src/points.ts),
// from NaPTAN's open list of stops (and RTT's locations, so with no RTT, no points), and the junctions
// and other timing points from the kept copy of BPLAN (packages/core/data, by scripts/bplan.mjs); if
// NaPTAN can't be asked, it says so and writes no points.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { compactPlaces, placesProblems } from "../../packages/core/src/places.ts";
import { compactPoints, naptanStations, pointsProblems } from "../../packages/core/src/points.ts";
import { bplanProblems } from "../../packages/core/src/bplan.ts";

const RTT = "https://data.rtt.io";
const out = process.argv[2];
const secret = (process.env.RTT_TOKEN ?? "").trim().replace(/^Bearer\s+/i, "");
const warn = (msg) => {
  console.log(`::warning title=No place list::${msg} The set-up form will ask for codes instead of offering names.`);
  process.exit(0);
};
if (!secret || !out) warn("No RTT_TOKEN, or nowhere to write.");

// A refresh token is swapped for an access token; an access token is used as it is.
let token = secret;
const swap = await fetch(`${RTT}/api/get_access_token`, { headers: { Authorization: `Bearer ${secret}` } }).catch(() => undefined);
if (swap?.ok) {
  const t = (await swap.json().catch(() => ({}))).token;
  if (t) {
    console.log(`::add-mask::${t}`);
    token = t;
  }
}
const get = async (path, key) => {
  const r = await fetch(`${RTT}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }).catch(() => undefined);
  if (!r?.ok) warn(`RTT answered ${r?.status ?? "nothing"} for ${path}.`);
  const list = (await r.json().catch(() => ({})))[key];
  if (!Array.isArray(list) || !list.length) warn(`RTT sent no ${key} from ${path}.`);
  return list;
};
const locations = await get("/data/locations_ungrouped", "locations");
const places = compactPlaces(locations, await get("/data/stops", "stops"));
const json = JSON.stringify(places);
// The same check the health check makes: a list that's oddly big or the wrong shape isn't shipped.
const problems = placesProblems(json);
if (problems.length) warn(`The list doesn't look right (${problems.join("; ")}).`);
writeFileSync(out, json);
console.log(`${out}: ${places.stations.length} stations and ${places.others.length} other timing points, ${Math.round(json.length / 1024)} KB`);

// Where each station is on the map. No token: NaPTAN is open to all.
const NAPTAN = "https://naptan.api.dft.gov.uk/v1/access-nodes?dataFormat=csv&atcoAreaCodes=910";
const pointsOut = join(dirname(out), "points.json");
const noPoints = (msg) => console.log(`::warning title=No points::${msg} The map won't show where stations are.`);
const r = await fetch(NAPTAN, { headers: { "User-Agent": "too-too-soon/1 (+https://github.com/thesnwmn/too-too-soon)" } }).catch(() => undefined);
const stations = r?.ok ? naptanStations(await r.text()) : [];
if (!stations.length) noPoints(`NaPTAN answered ${r?.status ?? "nothing"}, with no rail stations.`);
else {
  // Junctions and other timing points from the kept copy of BPLAN (scripts/bplan.mjs), if it's fit to use.
  const BPLAN = "packages/core/data/bplan-points.json";
  const bplanJson = existsSync(BPLAN) ? readFileSync(BPLAN, "utf8") : "";
  const bplanBad = bplanJson ? bplanProblems(bplanJson) : ["none kept"];
  const bplan = bplanBad.length ? undefined : JSON.parse(bplanJson);
  if (!bplan) console.log(`::warning title=No junctions::BPLAN: ${bplanBad.join("; ")}. The map shows stations only.`);
  const { dropped, ...points } = compactPoints(stations, locations, places, bplan?.points ?? []);
  const pointsJson = JSON.stringify(points);
  const pointsBad = pointsProblems(pointsJson);
  if (pointsBad.length) noPoints(`The list doesn't look right (${pointsBad.join("; ")}).`);
  else {
    writeFileSync(pointsOut, pointsJson);
    const spot = (code) => points.points.find((p) => p[0] === code)?.slice(1).join(", ") ?? "not placed";
    const placedStations = places.stations.filter(([, c]) => points.points.some((p) => p[0] === c)).length;
    console.log(`${pointsOut}: ${placedStations} of ${places.stations.length} stations and ${points.points.length - placedStations} of ${places.others.length} other timing points placed, from ${stations.length} NaPTAN rail stops and ${bplan ? `BPLAN ${bplan.source}` : "no BPLAN"}, ${Math.round(pointsJson.length / 1024)} KB`);
    if (dropped.length) console.log(`  left out ${dropped.length} BPLAN points too far from their station, or from any: ${dropped.slice(0, 12).join(", ")}${dropped.length > 12 ? " …" : ""}`);
    for (const code of ["WOK", "BKO", "CLJ", "WOKINGJ", "BRKWDLE"]) console.log(`  ${code}: ${spot(code)}`);
  }
}
