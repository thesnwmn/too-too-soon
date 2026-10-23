import { describe, expect, it } from "vitest";
import { noDom, noToken, typecheck } from "../src/code.ts";
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
});
