// A one-off look at what RTT really sends for a location, to learn fields the spec leaves
// "TBD" (allocations): run by probe.yml with `sample` set. Prints a few services' metadata,
// never the token (the access token is masked in the log).
import { appendFileSync } from "node:fs";

const RTT = "https://data.rtt.io";
const secret = (process.env.RTT_TOKEN ?? "").trim().replace(/^Bearer\s+/i, "");
if (!secret) {
  console.log("::error::No RTT_TOKEN secret.");
  process.exit(1);
}
let token = secret;
const swap = await fetch(`${RTT}/api/get_access_token`, { headers: { Authorization: `Bearer ${secret}` } });
if (swap.ok) {
  const t = (await swap.json()).token;
  if (t) {
    console.log(`::add-mask::${t}`);
    token = t;
  }
}
const get = (path) => fetch(`${RTT}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
const code = process.env.SAMPLE;
const r = await get(`/gb-nr/location?${new URLSearchParams({ code, detailed: "true" })}`);
const lines = [`## RTT sample at ${code}: ${r.status}`, ""];
const body = r.ok ? await r.json() : {};
const services = body.services ?? [];
const pick = [...services.filter((s) => s.scheduleMetadata?.inPassengerService).slice(0, 3), ...services.filter((s) => !s.scheduleMetadata?.inPassengerService).slice(0, 2)];
for (const s of pick) {
  const { scheduleMetadata, locationMetadata, origin, destination } = s;
  lines.push("```json", JSON.stringify({ scheduleMetadata, locationMetadata, origin: origin?.map((o) => o.location), destination: destination?.map((d) => d.location), keys: Object.keys(s) }, null, 2), "```", "");
}
// One service in full, for its allocationData.
const id = pick[0]?.scheduleMetadata?.uniqueIdentity;
if (id) {
  const sr = await get(`/gb-nr/service?${new URLSearchParams({ uniqueIdentity: id })}`);
  const sb = sr.ok ? await sr.json() : {};
  lines.push(`### /gb-nr/service ${id}: ${sr.status}`, "", "```json", JSON.stringify({ allocationData: sb.service?.allocationData, scheduleMetadata: sb.service?.scheduleMetadata, keys: Object.keys(sb.service ?? {}) }, null, 2).slice(0, 6000), "```");
}
const out = lines.join("\n");
console.log(out);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, out + "\n");
