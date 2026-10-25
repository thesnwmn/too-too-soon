import { describe, expect, it } from "vitest";
import { bplanAt, icons, mapLazy, places, points, rttHost, noDom, noToken, pngSize, typecheck, wrangler } from "../src/code.ts";
import { ctx, fakeShell, tmpDir } from "./fixture.ts";
import { packPoints } from "../../../packages/core/src/points.ts";

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

describe("code/icons", () => {
  /** Just a PNG's signature and header: enough to say its size. */
  const png = (w: number, h: number) => {
    const b = new Uint8Array(24);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    new DataView(b.buffer).setUint32(16, w);
    new DataView(b.buffer).setUint32(20, h);
    return b;
  };
  const manifest = JSON.stringify({ icons: [{ src: "icon.svg", sizes: "any" }, { src: "icon-180.png", sizes: "180x180" }] });
  it("reads a PNG's size", () => expect(pngSize(png(180, 90))).toEqual({ w: 180, h: 90 }));
  it("passes when every icon is there at its size", () => {
    const root = tmpDir({ "web/public/manifest.webmanifest": manifest, "web/public/icon.svg": "<svg/>", "web/public/icon-180.png": png(180, 180) });
    expect(icons.run(ctx(root)).status).toBe("pass");
  });
  it("fails on an icon at the wrong size, or missing", () => {
    const r = icons.run(ctx(tmpDir({ "web/public/manifest.webmanifest": manifest, "web/public/icon-180.png": png(192, 192) })));
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("icon.svg: missing");
    expect(r.detail).toContain("icon-180.png: 192x192");
  });
});

describe("code/rtt-clients", () => {
  const rtt = 'const RTT = "https://data.rtt.io";\n';
  it("passes when only the Worker and the sample script name RTT's host", () => {
    expect(rttHost.run(ctx(tmpDir({ "worker/src/rtt.ts": rtt, ".github/scripts/rtt-sample.mjs": rtt, "worker/src/handle.ts": "// asks rtt.ts\n" }))).status).toBe("pass");
  });
  it("fails on another file that does", () => {
    const r = rttHost.run(ctx(tmpDir({ "worker/src/rtt.ts": rtt, ".github/scripts/probe.mjs": rtt, "packages/core/src/x.ts": rtt })));
    expect(r.status).toBe("fail");
    expect(r.out?.split("\n").sort()).toEqual([".github/scripts/probe.mjs", "packages/core/src/x.ts"]);
  });
});

describe("code/places", () => {
  const good = JSON.stringify({ v: 1, stations: [["Woking", "WOK"]], others: [["Woking Jn", "WOKINGJ"]] });
  it("passes with no list made, or a good one", () => {
    expect(places.run(ctx(tmpDir())).status).toBe("pass");
    expect(places.run(ctx(tmpDir({ "web/public/places.json": good }))).status).toBe("pass");
  });
  it("fails on the wrong shape, or a list that's far too big", () => {
    expect(places.run(ctx(tmpDir({ "web/public/places.json": '{"v":1,"stations":[],"others":[]}' }))).detail).toBe("no stations");
    expect(places.run(ctx(tmpDir({ "web/public/places.json": JSON.stringify({ v: 1, stations: [["Woking", "wok"]], others: [] }) }))).detail).toBe("a station isn't [name, code]");
    expect(places.run(ctx(tmpDir({ "web/public/places.json": "x".repeat(1_600_000) }))).status).toBe("fail");
  });
});

describe("code/points", () => {
  const list = (n: number) => packPoints(Array.from({ length: n }, (_, i) => [`P${String(i).padStart(4, "0")}`, 51.3, -0.55] as [string, number, number]));
  const at = (json?: string) => points.run(ctx(tmpDir(json === undefined ? {} : { "web/public/points.json": json })));
  it("passes with no list made, or a good one", () => {
    expect(at().status).toBe("pass");
    expect(at(JSON.stringify(list(1200))).status).toBe("pass");
  });
  it("fails on a list with almost none placed, a point outside Great Britain, or the wrong shape", () => {
    expect(at(JSON.stringify(list(5))).detail).toBe("only 5 points, fewer than 1000");
    const away = list(1200);
    away.lon[0] += 1_200_000;
    expect(at(JSON.stringify(away)).detail).toMatch(/^P\d{4} is outside Great Britain/);
    expect(at('{"v":1,"points":[]}').detail).toBe("version 1, not 2");
  });
});

describe("code/bplan", () => {
  const kept = (n: number, source = "02-06-2024 to 14-12-2024, made 24-05-2024") => JSON.stringify({ v: 1, source, points: Array.from({ length: n }, (_, i) => [`T${String(i).padStart(4, "0")}`, 51.3, -0.56]) });
  const check = bplanAt(() => Date.UTC(2026, 9, 25));
  const at = (json?: string) => check.run(ctx(tmpDir(json === undefined ? {} : { "packages/core/data/bplan-points.json": json })));
  it("passes with none kept, or a good one", () => {
    expect(at().status).toBe("pass");
    expect(at(kept(3500))).toEqual({ status: "pass", detail: "BPLAN 02-06-2024 to 14-12-2024, made 24-05-2024" });
  });
  it("fails a copy with almost nothing in it, or a point outside Great Britain", () => {
    expect(at(kept(10)).detail).toBe("only 10 points, fewer than 3000");
    const away = JSON.parse(kept(3500));
    away.points[0] = ["ACTNLRG", 55.8195, 2.25563];
    expect(at(JSON.stringify(away)).status).toBe("fail");
  });
  it("fails the wrong shape: a version, a source, a TIPLOC or a point's length", () => {
    const good = JSON.parse(kept(3500));
    expect(at(JSON.stringify({ ...good, v: 3 })).detail).toBe("version 3, not 1");
    expect(at(JSON.stringify({ ...good, source: "" })).detail).toBe("no source");
    const badCode = JSON.parse(kept(3500));
    badCode.points[0] = ["woking jn", 51.3, -0.56];
    expect(at(JSON.stringify(badCode)).detail).toMatch(/isn't \[TIPLOC, lat, lon\]/);
    const short = JSON.parse(kept(3500));
    short.points[0] = ["WOKINGJ", 51.3];
    expect(at(JSON.stringify(short)).detail).toMatch(/isn't \[TIPLOC, lat, lon\]/);
  });
  it("warns once it's two years past its end", () => {
    expect(at(kept(3500, "01-06-2023 to 10-12-2023, made 20-05-2023")).status).toBe("warn");
  });
});
