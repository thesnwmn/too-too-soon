// Tier 4, code: it type-checks, the tests pass, the site builds, and the conventions in
// CLAUDE.md that a script can test still hold.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Check, type Ctx, fail, findInCode, pass, sourceFiles, tail } from "./check.ts";

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
  hint: "RTT's terms say the token never reaches a browser (tokens found in pages get revoked). The page asks the Worker (/api/…); only worker/ talks to data.rtt.io. See docs/architecture.md.",
  run({ root }) {
    const files = BROWSER.flatMap((d) => sourceFiles(root, d, [".ts", ".js", ".html"]));
    // Comments count too: stripping them would also strip the "//" out of a URL.
    const hits = files.flatMap((f) => readFileSync(join(root, f), "utf8").split("\n").flatMap((line, i) => (SECRETS.test(line) ? [`${f}:${i + 1}: ${line.trim()}`] : [])));
    return hits.length ? fail(`${hits.length} mention${hits.length === 1 ? "" : "s"}`, hits.join("\n")) : pass(`${files.length} files`);
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

// Cheap scans first, so a broken convention shows before the slow runs.
export const CODE = [noToken, noDom, typecheck, test, build];
