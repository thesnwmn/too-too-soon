// Keeps a small copy of Network Rail's BPLAN (the Geography file the producer downloads, which
// needs an account): `pnpm bplan <Geography_….txt or .txt.gz>`. Writes packages/core/data/bplan-points.json,
// [TIPLOC, lat, lon] for each timing point with a place (packages/core/src/bplan.ts), which the
// deploy joins into points.json. Run again with a newer BPLAN every year or so.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { bplanPoints, bplanProblems } from "../packages/core/src/bplan.ts";

const OUT = "packages/core/data/bplan-points.json";
const file = process.argv[2];
if (!file) {
  console.error("Usage: pnpm bplan <Geography_….txt or .txt.gz>");
  process.exit(1);
}
const raw = readFileSync(file);
// BPLAN is plain ASCII, or near enough: latin1 keeps any odd byte as one character.
const text = (raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw).toString("latin1");
const kept = bplanPoints(text);
const json = JSON.stringify(kept);
const problems = bplanProblems(json);
if (problems.length) {
  console.error(`Not kept: ${problems.join("; ")}`);
  process.exit(1);
}
mkdirSync("packages/core/data", { recursive: true });
writeFileSync(OUT, json + "\n");
const at = (code) => kept.points.find((p) => p[0] === code)?.slice(1).join(", ") ?? "not placed";
console.log(`${OUT}: ${kept.points.length} timing points, BPLAN ${kept.source}, ${Math.round(json.length / 1024)} KB`);
for (const code of ["WOKINGJ", "WOKING", "BRKWOOD", "CLPHMJN"]) console.log(`  ${code}: ${at(code)}`);
