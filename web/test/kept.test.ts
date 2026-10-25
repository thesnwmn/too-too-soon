import { describe, expect, it } from "vitest";
import { keptJson } from "../src/kept.ts";

/** The Cache API, in a Map. */
function fakeCaches(init: Record<string, unknown> = {}) {
  const m = new Map<string, Response>(Object.entries(init).map(([k, v]) => [k, json(v)]));
  const cache = {
    match: async (url: string) => m.get(url)?.clone(),
    put: async (url: string, r: Response) => void m.set(url, r),
  } as unknown as Cache;
  return { caches: { open: async () => cache }, m };
}
const json = (v: unknown) => new Response(JSON.stringify(v), { headers: { "Content-Type": "application/json" } });
const page = () => new Response("<!doctype html>", { headers: { "Content-Type": "text/html" } });
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("keptJson", () => {
  it("fetches the file and keeps it on the phone", async () => {
    const c = fakeCaches();
    expect(await keptJson("points.json", { caches: c.caches, fetch: async () => json({ v: 2 }) })).toEqual({ v: 2 });
    expect(await c.m.get("points.json")?.clone().json()).toEqual({ v: 2 });
  });
  it("uses the kept copy at once, even with no signal", async () => {
    const c = fakeCaches({ "points.json": { v: "kept" } });
    expect(await keptJson("points.json", { caches: c.caches, fetch: () => Promise.reject(new TypeError("offline")) })).toEqual({ v: "kept" });
  });
  it("fetches a fresh copy behind the kept one, for next time (a new deploy's file replaces it)", async () => {
    const c = fakeCaches({ "points.json": { v: "old" } });
    expect(await keptJson("points.json", { caches: c.caches, fetch: async () => json({ v: "new" }) })).toEqual({ v: "old" });
    await tick();
    expect(await keptJson("points.json", { caches: c.caches, fetch: () => Promise.reject(new TypeError("offline")) })).toEqual({ v: "new" });
  });
  it("is undefined, and keeps nothing, when the site sends a page instead (a host that serves one for every path)", async () => {
    const c = fakeCaches();
    expect(await keptJson("points.json", { caches: c.caches, fetch: async () => page() })).toBeUndefined();
    expect(c.m.size).toBe(0);
  });
  it("is undefined with no copy and no signal", async () => {
    expect(await keptJson("points.json", { caches: fakeCaches().caches, fetch: () => Promise.reject(new TypeError("offline")) })).toBeUndefined();
  });
  it("works without the Cache API (an old browser, or not a secure page)", async () => {
    expect(await keptJson("points.json", { fetch: async () => json({ v: 2 }) })).toEqual({ v: 2 });
    const broken = { open: () => Promise.reject(new Error("SecurityError")) };
    expect(await keptJson("points.json", { caches: broken, fetch: async () => json({ v: 2 }) })).toEqual({ v: 2 });
  });
});
