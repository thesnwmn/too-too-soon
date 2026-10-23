// Asks the live Worker /api/info and /api/next, and says what came back: run by probe.yml.
import { appendFileSync } from "node:fs";

const site = (process.env.SITE || "").replace(/\/$/, "");
if (!site) {
  console.log("::error::No site: give the url input.");
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
const lines = [`## Probe of ${site}`, "", "**/api/info**", "", "```json", JSON.stringify(info, null, 2), "```", "", `**/api/next?${q}**: ${next.status}`, ""];
const passes = next.body?.passes;
if (Array.isArray(passes)) {
  lines.push(`${passes.length} trains between ${next.body.aName ?? q.get("a")} and ${next.body.bName ?? q.get("b")}${next.body.stale ? " (stale)" : ""}${next.body.limited ? " (live data limited)" : ""}:`, "");
  lines.push("| time | dir | headcode | what | basis | late | stops |", "|---|---|---|---|---|---|---|");
  for (const p of passes.slice(0, 25))
    lines.push(`| ${clock(p.time)} | ${p.direction} | ${p.headcode ?? ""} | ${p.passenger ? `${p.coaches ?? "?"} coaches to ${p.destination ?? "?"}` : "freight/ECS"} | ${p.basis} | ${p.late ?? ""} | ${[p.stopsBefore && "before", p.stopsAfter && "after"].filter(Boolean).join(", ") || "non-stop"} |`);
} else lines.push("```json", JSON.stringify(next.body, null, 2), "```");
const out = lines.join("\n");
console.log(out);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, out + "\n");
