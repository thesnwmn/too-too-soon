import { describe, expect, it } from "vitest";
import { mapLazy, noDom, noToken, typecheck, wrangler } from "../src/code.ts";
import { ctx, fakeShell, tmpDir } from "./fixture.ts";

describe("code/typecheck (and the other pnpm runs)", () => {
  it("passes when the script does", () => expect(typecheck.run(ctx(tmpDir(), { sh: fakeShell({ "pnpm typecheck": {} }) })).status).toBe("pass"));
  it("fails with the output when it doesn't", () => {
    const r = typecheck.run(ctx(tmpDir(), { sh: fakeShell({ "pnpm typecheck": { code: 2, out: "src/a.ts(1,7): error TS2322" } }) }));
    expect(r.status).toBe("fail");
    expect(r.out).toContain("TS2322");
  });
});

describe("code/no-token-in-page", () => {
  it("passes on a page that asks the Worker", () => {
    const root = tmpDir({ "web/src/main.ts": "// asks the Worker\nfetch('/api/next');\n" });
    expect(noToken.run(ctx(root)).status).toBe("pass");
  });
  it("fails on a page that calls RTT itself", () => {
    const r = noToken.run(ctx(tmpDir({ "web/src/api.ts": "const a = 1;\nfetch('https://data.rtt.io/gb-nr/location');\n" })));
    expect(r.status).toBe("fail");
    expect(r.out).toBe("web/src/api.ts:2: fetch('https://data.rtt.io/gb-nr/location');");
  });
  it("fails on a bearer header in the page", () => {
    expect(noToken.run(ctx(tmpDir({ "web/src/a.ts": "headers.set('Authorization', t);\n" }))).status).toBe("fail");
  });
});

describe("code/no-dom", () => {
  it("passes on DOM-free shared code", () => expect(noDom.run(ctx(tmpDir({ "packages/core/src/a.ts": "export const windowMinutes = 90;\n" }))).status).toBe("pass"));
  it("fails on the DOM in core", () => {
    const r = noDom.run(ctx(tmpDir({ "packages/core/src/spot.ts": "export const s = localStorage.getItem('spot');\n" })));
    expect(r.status).toBe("fail");
    expect(r.out).toBe("packages/core/src/spot.ts:1: export const s = localStorage.getItem('spot');");
  });
  it("fails on fetching in core", () => {
    const r = noDom.run(ctx(tmpDir({ "packages/core/src/rtt.ts": "export const get = (u: string) => fetch(u);\n" })));
    expect(r.status).toBe("fail");
  });
});

describe("code/wrangler", () => {
  const good = '[assets]\ndirectory = "../web/dist"\nrun_worker_first = ["/api/*"]\n';
  it("passes on a config that serves the page and keeps no secrets", () => expect(wrangler.run(ctx(tmpDir({ "worker/wrangler.toml": good }))).status).toBe("pass"));
  it("fails on the token in config", () => expect(wrangler.run(ctx(tmpDir({ "worker/wrangler.toml": good + '[vars]\nRTT_TOKEN = "abc"\n' }))).detail).toMatch(/secret/));
  it("fails when the API isn't routed to the Worker first", () => expect(wrangler.run(ctx(tmpDir({ "worker/wrangler.toml": '[assets]\ndirectory = "../web/dist"\n' }))).status).toBe("fail"));
});

describe("code/map-lazy", () => {
  const picker = { "web/src/picker.ts": 'import * as maplibregl from "maplibre-gl";\nimport "maplibre-gl/dist/maplibre-gl.css";\n' };
  it("passes when only the picker imports MapLibre, and the page loads it lazily", () =>
    expect(mapLazy.run(ctx(tmpDir({ ...picker, "web/src/main.ts": 'const { openPicker } = await import("./picker.ts");\n' }))).status).toBe("pass"));
  it("fails on MapLibre imported by the watch view", () => expect(mapLazy.run(ctx(tmpDir({ ...picker, "web/src/main.ts": 'import { Map } from "maplibre-gl";\n' }))).status).toBe("fail"));
  it("fails on the picker imported statically, or re-exported", () => {
    expect(mapLazy.run(ctx(tmpDir({ ...picker, "web/src/main.ts": 'import { openPicker } from "./picker.ts";\n' }))).status).toBe("fail");
    expect(mapLazy.run(ctx(tmpDir({ ...picker, "web/src/map.ts": 'export { Map } from "maplibre-gl";\n' }))).status).toBe("fail");
  });
});
