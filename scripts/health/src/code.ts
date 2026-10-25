// Tier 4, code: it type-checks, the tests pass, the site builds, and the conventions in
// CLAUDE.md that a script can test still hold.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { placesProblems } from "../../../packages/core/src/places.ts";
import { pointsProblems } from "../../../packages/core/src/points.ts";
import { bplanEnds, bplanProblems } from "../../../packages/core/src/bplan.ts";
import { type Check, type Ctx, fail, findInCode, pass, sourceFiles, tail, warn } from "./check.ts";

const pnpmScript = (id: string, script: string, hint: string, slow = false): Check => ({
  id,
  tier: 4,
  slow,
  repro: `pnpm ${script}`,
  hint,
  run({ sh }: Ctx) {
    const r = sh("pnpm", [script]);
    return r.code === 0 ? pass() : fail(`pnpm ${script} failed`, tail(r.out));
  },
});

export const typecheck = pnpmScript("code/typecheck", "typecheck", "A type error: the output names the package and line.");
export const test = pnpmScript("code/test", "test", "A failing test: the output names the package and test.");
export const build = pnpmScript("code/build", "build", "Something doesn't build: the page's Vite build or the Worker's dry run.", true);

/** Code that ends up in the browser. */
export const BROWSER = ["web/src", "web/index.html"];
/** What only the Worker may know: the RTT host and its token. */
const SECRETS = /\bdata\.rtt\.io\b|\bRTT_TOKEN\b|\bAuthorization\b|\bBearer\b/;

export const noToken: Check = {
  id: "code/no-token-in-page",
  tier: 4,
  repro: `grep -rnE "data\\.rtt\\.io|RTT_TOKEN|Authorization|Bearer" ${BROWSER.join(" ")}`,
  hint: "RTT's terms say the token never reaches a browser (tokens found in pages get revoked). The page asks the Worker (/api/…); only worker/ (and a sample script run by hand from GitHub) talks to data.rtt.io. See docs/architecture.md.",
  run({ root }) {
    const files = BROWSER.flatMap((d) => sourceFiles(root, d, [".ts", ".js", ".html"]));
    // Comments count too: stripping them would also strip the "//" out of a URL.
    const hits = files.flatMap((f) => readFileSync(join(root, f), "utf8").split("\n").flatMap((line, i) => (SECRETS.test(line) ? [`${f}:${i + 1}: ${line.trim()}`] : [])));
    return hits.length ? fail(`${hits.length} mention${hits.length === 1 ? "" : "s"}`, hits.join("\n")) : pass(`${files.length} files`);
  },
};

/** The code that may talk to RTT itself: the Worker, the deploy's place list, and a sample script run by hand from GitHub. */
export const RTT_CLIENTS = ["worker/src/rtt.ts", ".github/scripts/places.mjs", ".github/scripts/rtt-sample.mjs"];
/** Where else code lives that might be tempted. */
const RTT_SCAN = ["web", "packages", "worker/src", ".github"];

export const rttHost: Check = {
  id: "code/rtt-clients",
  tier: 4,
  repro: `grep -rln "data\\.rtt\\.io" ${RTT_SCAN.join(" ")}`,
  hint: `Only ${RTT_CLIENTS.join(" and ")} talk to data.rtt.io: everything else asks the Worker. A new RTT client needs the token, so it's a decision: add it to RTT_CLIENTS in scripts/health/src/code.ts and say why in docs/architecture.md#the-token-rule.`,
  run({ root }) {
    const files = RTT_SCAN.flatMap((d) => sourceFiles(root, d, [".ts", ".mjs", ".js", ".html", ".yml"]));
    const hits = files.filter((f) => !RTT_CLIENTS.includes(f) && /\bdata\.rtt\.io\b/.test(readFileSync(join(root, f), "utf8")));
    return hits.length ? fail(`${hits.length} other file${hits.length === 1 ? "" : "s"}`, hits.join("\n")) : pass(`${files.length} files`);
  },
};

/** Shared logic that runs in the Worker, the page and Node tests, so may not touch the DOM, or fetch: callers do the asking. */
export const NO_DOM = ["packages/core/src"];
const DOM_GLOBALS = /\b(document|window|navigator|localStorage|sessionStorage|requestAnimationFrame|HTML\w*Element)\b|\bfetch\s*\(/;

export const noDom: Check = {
  id: "code/no-dom",
  tier: 4,
  repro: `grep -rnE "document|window|navigator|localStorage|fetch\\(" ${NO_DOM.join(" ")}`,
  hint: "packages/core is pure functions: it runs in the Worker and in Node tests as well as the page, so it has no DOM and doesn't fetch. Move DOM code to web/src, and fetching to the Worker or the page.",
  run({ root }) {
    const files = NO_DOM.flatMap((d) => sourceFiles(root, d));
    const hits = findInCode(root, files, DOM_GLOBALS);
    return hits.length ? fail(`${hits.length} use${hits.length === 1 ? "" : "s"}`, hits.join("\n")) : pass(`${files.length} files`);
  },
};

export const WRANGLER = "worker/wrangler.toml";

export const wrangler: Check = {
  id: "code/wrangler",
  tier: 4,
  repro: `cat ${WRANGLER}`,
  hint: "The Worker's config serves the page from web/dist and holds no secrets: RTT_TOKEN is a Worker secret, set by .github/workflows/deploy.yml from the GitHub secret. See docs/architecture.md#the-token-rule.",
  run({ root }) {
    const path = join(root, WRANGLER);
    if (!existsSync(path)) return pass("no Worker");
    const toml = readFileSync(path, "utf8").replace(/#.*$/gm, "");
    const problems: string[] = [];
    if (/RTT_TOKEN/.test(toml)) problems.push("names RTT_TOKEN: it's a secret, never config");
    if (!/^\s*directory\s*=\s*"\.\.\/web\/dist"/m.test(toml)) problems.push('assets directory isn\'t "../web/dist"');
    if (!/run_worker_first\s*=\s*\[\s*"\/api\/\*"\s*\]/.test(toml)) problems.push('run_worker_first isn\'t ["/api/*"], so the API might be served as the page');
    return problems.length ? fail(problems.join("; ")) : pass();
  },
};

/** The map picker, the only page code that may load MapLibre, and only by a dynamic import. */
export const PICKER = "web/src/picker.ts";

export const mapLazy: Check = {
  id: "code/map-lazy",
  tier: 4,
  repro: `grep -rn "maplibre-gl\\|picker" web/src`,
  hint: "MapLibre is about 1 MB: only web/src/picker.ts imports it, and the rest of the page loads the picker with import(\"./picker.ts\"), so the watch view stays small on a phone at the bridge.",
  run({ root }) {
    const files = sourceFiles(root, "web/src").filter((f) => f !== PICKER);
    const hits = files.flatMap((f) =>
      readFileSync(join(root, f), "utf8")
        .split("\n")
        .flatMap((line, i) => (/^\s*(import|export)\s.*["'](maplibre-gl[^"']*|\.\/picker(\.ts)?)["']/.test(line) ? [`${f}:${i + 1}: ${line.trim()}`] : [])),
    );
    return hits.length ? fail(`${hits.length} static import${hits.length === 1 ? "" : "s"}`, hits.join("\n")) : pass(`${files.length} files`);
  },
};

export const MANIFEST = "web/public/manifest.webmanifest";

/** A PNG's width and height, from its header; undefined if it isn't a PNG. */
export function pngSize(bytes: Uint8Array): { w: number; h: number } | undefined {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || sig.some((b, i) => bytes[i] !== b)) return undefined;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { w: v.getUint32(16), h: v.getUint32(20) };
}

export const icons: Check = {
  id: "code/icons",
  tier: 4,
  repro: `cat ${MANIFEST}`,
  hint: "Every icon the web manifest lists is in web/public at the size it says. The PNGs are drawn from icon.svg: pnpm --filter @too-too-soon/web icons.",
  run({ root }) {
    const path = join(root, MANIFEST);
    if (!existsSync(path)) return pass("no manifest");
    const list = (JSON.parse(readFileSync(path, "utf8")) as { icons?: { src: string; sizes?: string }[] }).icons ?? [];
    const problems = list.flatMap(({ src, sizes }) => {
      const file = join(root, "web/public", src);
      if (!existsSync(file)) return [`${src}: missing`];
      const m = sizes?.match(/^(\d+)x(\d+)$/);
      if (!m) return [];
      const got = pngSize(readFileSync(file));
      if (!got) return [`${src}: not a PNG`];
      return got.w === Number(m[1]) && got.h === Number(m[2]) ? [] : [`${src}: ${got.w}x${got.h}, but the manifest says ${sizes}`];
    });
    return problems.length ? fail(problems.join("; ")) : pass(`${list.length} icons`);
  },
};

/** The set-up form's place list, made at deploy time (.github/scripts/places.mjs), so only there when one's been made. */
export const PLACES = "web/public/places.json";

export const places: Check = {
  id: "code/places",
  tier: 4,
  repro: `node -e "console.log(require('fs').statSync('${PLACES}').size)"`,
  hint: "The place list the set-up form searches is { v: 1, stations: [[name, CRS]], others: [[name, TIPLOC]] } and under PLACES_MAX_BYTES (packages/core/src/places.ts). It's made by .github/scripts/places.mjs, which makes the same check before writing it; the demo's small one is web/demo/places.json.",
  run({ root }) {
    const made = join(root, PLACES);
    const demo = join(root, DEMO_PLACES);
    const problems = [
      ...(existsSync(made) ? placesProblems(readFileSync(made, "utf8")).map((p) => `${PLACES}: ${p}`) : []),
      ...(existsSync(demo) ? placesProblems(readFileSync(demo, "utf8")).map((p) => `${DEMO_PLACES}: ${p}`) : []),
    ];
    if (problems.length) return fail(problems.join("; "));
    return pass(existsSync(made) ? `${Math.round(readFileSync(made).length / 1024)} KB` : "none made here");
  },
};

/** The demo's small place list and points, for GitHub Pages (web/demo/README.md). */
export const DEMO_PLACES = "web/demo/places.json";
export const DEMO_POINTS = "web/demo/points.json";

/** Where each station is on the map, made beside the place list at deploy time (.github/scripts/places.mjs). */
export const POINTS = "web/public/points.json";

export const points: Check = {
  id: "code/points",
  tier: 4,
  repro: `node -e "console.log(require('fs').statSync('${POINTS}').size)"`,
  hint: "The points list is packed, { v: 2, codes, lat, lon } (packPoints), at least POINTS_MIN of them (10 in the demo's), all in Great Britain, under POINTS_MAX_BYTES (packages/core/src/points.ts). It's made by .github/scripts/places.mjs from NaPTAN, which makes the same check before writing it; the demo's small one is web/demo/points.json (if web/public/points.json has only 14, it's the demo's, copied in by hand to try the Pages build: delete it).",
  run({ root }) {
    const made = join(root, POINTS);
    const demo = join(root, DEMO_POINTS);
    const problems = [
      ...(existsSync(made) ? pointsProblems(readFileSync(made, "utf8")).map((p) => `${POINTS}: ${p}`) : []),
      ...(existsSync(demo) ? pointsProblems(readFileSync(demo, "utf8"), 10).map((p) => `${DEMO_POINTS}: ${p}`) : []),
    ];
    if (problems.length) return fail(problems.join("; "));
    return pass(existsSync(made) ? `${Math.round(readFileSync(made).length / 1024)} KB` : "none made here");
  },
};

/** The kept copy of Network Rail's BPLAN (scripts/bplan.mjs), which the deploy joins into points.json. */
export const BPLAN = "packages/core/data/bplan-points.json";
const YEAR = 365.25 * 24 * 3600_000;

/** The check, with a clock: it warns once the BPLAN it was made from is two years past its end. */
export const bplanAt = (now: () => number): Check => ({
  id: "code/bplan",
  tier: 4,
  repro: `node -e "console.log(JSON.parse(require('fs').readFileSync('${BPLAN}','utf8')).source)"`,
  hint: "The kept copy of BPLAN is { v: 1, source, points: [[TIPLOC, lat, lon]] }, at least BPLAN_MIN of them, all in Great Britain, under BPLAN_MAX_BYTES (packages/core/src/bplan.ts). Remake it from the producer's newer Geography file with `pnpm bplan <file>`; the producer gets one with the steps in studio/asks/junction-points.md.",
  run({ root }) {
    const path = join(root, BPLAN);
    if (!existsSync(path)) return pass("none kept: stations only");
    const json = readFileSync(path, "utf8");
    const problems = bplanProblems(json);
    if (problems.length) return fail(problems.join("; "));
    const source: string = JSON.parse(json).source;
    const ends = bplanEnds(source);
    if (ends !== undefined && now() - ends > 2 * YEAR) return warn(`BPLAN ${source}: over two years old, time for a newer one`);
    return pass(`BPLAN ${source}`);
  },
});
export const bplan = bplanAt(Date.now);

// Cheap scans first, so a broken convention shows before the slow runs.
export const CODE = [noToken, rttHost, noDom, wrangler, mapLazy, icons, places, points, bplan, typecheck, test, build];
