import { describe, expect, it } from "vitest";
import { handle } from "../src/handle.ts";

const deps = (answer: (url: string, init?: RequestInit) => Response | Promise<Response>) => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return answer(String(input), init);
  }) as typeof globalThis.fetch;
  const map = new Map<string, string>();
  return { calls, deps: { fetch, now: () => 0, store: { get: async (k: string) => map.get(k), put: async (k: string, v: string) => void map.set(k, v) } } };
};
const get = (q: string) => new Request(`https://x.example/api/osm?${q}`);
const OK = () => Response.json({ elements: [{ type: "node", id: 1 }] });

describe("/api/osm", () => {
  it("asks Overpass our own query, saying who it is, and passes the answer through", async () => {
    const d = deps(OK);
    const r = await handle(get("lat=51.30831&lon=-0.59407&radius=3000"), {}, d.deps);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ elements: [{ type: "node", id: 1 }] });
    const sent = d.calls[0];
    expect(new Headers(sent.init?.headers).get("User-Agent")).toMatch(/too-too-soon/);
    expect(String(sent.init?.body)).toContain(encodeURIComponent('way["railway"="rail"]').slice(0, 10));
  });
  it("moves on to the next server when the first is busy or turns us away", async () => {
    const d = deps((url) => (url.includes("overpass-api.de") ? new Response("<html>busy</html>", { status: 429, headers: { "Content-Type": "text/html" } }) : OK()));
    expect((await handle(get("lat=51.3&lon=-0.59&radius=3000"), {}, d.deps)).status).toBe(200);
    expect(d.calls).toHaveLength(2);
  });
  it("says busy, as JSON, when every server is", async () => {
    const d = deps(() => new Response("no", { status: 429 }));
    const r = await handle(get("lat=51.3&lon=-0.59&radius=8000"), {}, d.deps);
    expect(r.status).toBe(429);
    expect(r.headers.get("Content-Type")).toContain("json");
  });
  it("isn't an open proxy: only GB coordinates and the picker's radii", async () => {
    const d = deps(OK);
    for (const q of ["lat=40&lon=-74&radius=3000", "lat=51.3&lon=-0.59&radius=50000", "lat=x&lon=y&radius=3000", "data=[out:json];node;out;"])
      expect((await handle(get(q), {}, d.deps)).status).toBe(400);
    expect(d.calls).toEqual([]);
  });
});
