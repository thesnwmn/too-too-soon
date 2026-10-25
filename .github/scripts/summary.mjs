// The deploy's summary: where the site is, and what the token may do (/api/info).
// In Node rather than shell, so the JSON needs no quoting. Never sees the token itself.
import { appendFileSync } from "node:fs";

const url = process.env.URL ?? "";
const hasRtt = process.env.HAS_RTT === "true";
// The repo's logs are public, so the address stays out of them: it's the SITE_URL secret.
const out = ["## Deployed", "", `**Site:** ${url ? "deployed to its workers.dev address (the `SITE_URL` secret)" : "no workers.dev address in wrangler's output"}`, ""];

if (!hasRtt) out.push("No `RTT_TOKEN` secret yet, so the site has no live data. See studio/producer-guide.md#one-time-setup.");
else if (url) {
  // The secret rolls out a new version: give it a moment to answer as configured.
  let info;
  for (let i = 0; i < 6; i++) {
    info = await fetch(`${url}/api/info`).then((r) => r.json()).catch(() => undefined);
    if (info?.configured) break;
    await new Promise((r) => setTimeout(r, 10_000));
  }
  console.log("/api/info:", JSON.stringify(info));
  out.push("**/api/info** (`detailed: true` means passing trains are included):", "", "```json", JSON.stringify(info, null, 2), "```");
}
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, out.join("\n") + "\n");
else console.log(out.join("\n"));
