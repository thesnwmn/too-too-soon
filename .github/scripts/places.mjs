// Fetches RTT's stations and timing points and writes the small list the page searches
// (packages/core/src/places.ts): run by deploy.yml before the page is built, with the RTT_TOKEN
// secret, which never reaches the page. `node .github/scripts/places.mjs web/public/places.json`.
// If RTT can't be asked, it says so and writes nothing: the page then asks for codes instead.
import { writeFileSync } from "node:fs";
import { compactPlaces } from "../../packages/core/src/places.ts";

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
const places = compactPlaces(await get("/data/locations_ungrouped", "locations"), await get("/data/stops", "stops"));
const json = JSON.stringify(places);
writeFileSync(out, json);
console.log(`${out}: ${places.stations.length} stations and ${places.others.length} other timing points, ${Math.round(json.length / 1024)} KB`);
