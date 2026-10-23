import { beforeEach, describe, expect, it } from "vitest";
import { type DemoTrain, type InfoResponse, lineUps, type NextResponse } from "@too-too-soon/core";
import { FRESH_MS, handle, type Store } from "../src/handle.ts";
import { forgetToken } from "../src/rtt.ts";

const NOW = Date.parse("2026-10-24T14:00:00Z");
const train = (over: Partial<DemoTrain>): DemoTrain => ({ id: "X1", headcode: "1X01", at: 10, direction: "ab", run: 4, origin: "Here", destination: "There", ...over });

/** A fake RTT: answers the line-ups for `trains`, or `status` for every location call. */
function fakeRtt(opts: { trains?: DemoTrain[]; status?: number; refresh?: boolean; entitlements?: unknown; noWindow?: boolean } = {}) {
  const calls: { url: string; auth: string | null }[] = [];
  let clock = NOW;
  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const auth = new Headers(init?.headers).get("Authorization");
    calls.push({ url: url.toString(), auth });
    if (url.pathname === "/api/get_access_token") {
      return opts.refresh ? Response.json({ token: "short-life", validUntil: new Date(clock + 3600_000).toISOString(), entitlements: ["allowDetailed"] }) : new Response("no", { status: 403 });
    }
    if (url.pathname === "/api/info") return Response.json({ api_version: "2026-10-01", credentials: { entitlements: opts.entitlements ?? ["allowDetailed"] } });
    if (url.pathname === "/gb-nr/location") {
      if (opts.noWindow && url.searchParams.has("timeWindow")) return new Response(null, { status: 400 });
      if (opts.status) return new Response(null, { status: opts.status, headers: opts.status === 429 ? { "Retry-After": "30" } : {} });
      const ups = lineUps(opts.trains ?? [train({})], clock);
      return Response.json(url.searchParams.get("code") === "ASHBYJN" ? ups.a : ups.b);
    }
    return new Response("", { status: 404 });
  };
  const map = new Map<string, string>();
  const store: Store = { get: async (k) => map.get(k), put: async (k, v) => void map.set(k, v) };
  return {
    calls,
    deps: { fetch: fetch as typeof globalThis.fetch, now: () => clock, store },
    tick: (ms: number) => (clock += ms),
    fail: (status: number) => (opts.status = status),
  };
}

const env = { RTT_TOKEN: "secret-token" };
const get = (path: string) => new Request(`https://too-too-soon.example${path}`);
const SPOT = "/api/next?a=ASHBYJN&b=BRAMFD&f=0.25";

beforeEach(() => forgetToken());

describe("/api/next", () => {
  it("joins the two line-ups and returns the passes", async () => {
    const rtt = fakeRtt();
    const r = await handle(get(SPOT), env, rtt.deps);
    expect(r.status).toBe(200);
    const body = (await r.json()) as NextResponse;
    expect(body.passes).toHaveLength(1);
    expect(body.passes[0].time).toBe(NOW + 11 * 60_000);
    expect(body.aName).toBe("Ashby Junction");
    expect(body.stale).toBeUndefined();
  });
  it("asks RTT in detailed mode, from 15 minutes ago", async () => {
    const rtt = fakeRtt();
    await handle(get(SPOT), env, rtt.deps);
    const loc = new URL(rtt.calls.find((c) => c.url.includes("/gb-nr/location"))!.url);
    expect(loc.searchParams.get("detailed")).toBe("true");
    expect(loc.searchParams.get("timeFrom")).toBe("2026-10-24T13:45:00Z");
  });
  it("sends the token as given when RTT won't swap it (an access token)", async () => {
    const rtt = fakeRtt();
    await handle(get(SPOT), env, rtt.deps);
    expect(rtt.calls.filter((c) => c.url.includes("/gb-nr/location")).every((c) => c.auth === "Bearer secret-token")).toBe(true);
  });
  it("swaps a refresh token for an access token, once", async () => {
    const rtt = fakeRtt({ refresh: true });
    await handle(get(SPOT), env, rtt.deps);
    rtt.tick(FRESH_MS);
    await handle(get(SPOT), env, rtt.deps);
    expect(rtt.calls.filter((c) => c.url.includes("get_access_token"))).toHaveLength(1);
    expect(rtt.calls.filter((c) => c.url.includes("/gb-nr/location")).every((c) => c.auth === "Bearer short-life")).toBe(true);
  });
  it("shares one lookup per timing point for a minute", async () => {
    const rtt = fakeRtt();
    await handle(get(SPOT), env, rtt.deps);
    await handle(get("/api/next?a=ASHBYJN&b=BRAMFD&f=0.8"), env, rtt.deps);
    expect(rtt.calls.filter((c) => c.url.includes("/gb-nr/location"))).toHaveLength(2);
    rtt.tick(FRESH_MS);
    await handle(get(SPOT), env, rtt.deps);
    expect(rtt.calls.filter((c) => c.url.includes("/gb-nr/location"))).toHaveLength(4);
  });
  it("serves the last good list, marked stale, when RTT says 429", async () => {
    const rtt = fakeRtt();
    await handle(get(SPOT), env, rtt.deps);
    rtt.tick(FRESH_MS + 1);
    rtt.fail(429);
    const r = await handle(get(SPOT), env, rtt.deps);
    expect(r.status).toBe(200);
    expect(((await r.json()) as NextResponse).stale).toBe(true);
  });
  it("says so when RTT says 429 and there's nothing to fall back on", async () => {
    const rtt = fakeRtt({ status: 429 });
    const r = await handle(get(SPOT), env, rtt.deps);
    expect(r.status).toBe(429);
    expect(r.headers.get("Retry-After")).toBe("30");
  });
  it("asks without a time window when the token isn't allowed one", async () => {
    const rtt = fakeRtt({ noWindow: true });
    const r = await handle(get(SPOT), env, rtt.deps);
    expect(((await r.json()) as NextResponse).passes).toHaveLength(1);
  });
  it("treats 204 as no trains", async () => {
    const rtt = fakeRtt({ status: 204 });
    const r = await handle(get(SPOT), env, rtt.deps);
    expect(((await r.json()) as NextResponse).passes).toEqual([]);
  });
  it("rejects bad spots without asking RTT", async () => {
    const rtt = fakeRtt();
    for (const q of ["a=ASHBYJN", "a=ASHBYJN&b=BRAMFD&f=2", "a=../x&b=BRAMFD"]) expect((await handle(get(`/api/next?${q}`), env, rtt.deps)).status).toBe(400);
    expect(rtt.calls).toEqual([]);
  });
  it("says it isn't set up without a token", async () => {
    const r = await handle(get(SPOT), {}, fakeRtt().deps);
    expect(r.status).toBe(503);
  });
});

describe("/api/info", () => {
  it("says whether the token works and has detailed mode, never the token", async () => {
    const r = await handle(get("/api/info"), env, fakeRtt().deps);
    const text = await r.text();
    expect(text).not.toContain("secret-token");
    expect(JSON.parse(text) as InfoResponse).toMatchObject({ configured: true, ok: true, detailed: true, apiVersion: "2026-10-01" });
  });
  it("reads entitlements given as objects too", async () => {
    const r = await handle(get("/api/info"), env, fakeRtt({ entitlements: [{ name: "allowDetailed" }] }).deps);
    expect(((await r.json()) as InfoResponse).detailed).toBe(true);
  });
  it("says when there's no token", async () => expect(await (await handle(get("/api/info"), {}, fakeRtt().deps)).json()).toMatchObject({ configured: false }));
});

describe("everything else", () => {
  it("is the page, from the assets", async () => {
    const r = await handle(get("/"), { ASSETS: { fetch: async () => new Response("<html>") } }, fakeRtt().deps);
    expect(await r.text()).toBe("<html>");
  });
  it("is a 404 for unknown APIs, and only GET", async () => {
    expect((await handle(get("/api/nope"), env, fakeRtt().deps)).status).toBe(404);
    expect((await handle(new Request("https://x.example/api/next", { method: "POST" }), env, fakeRtt().deps)).status).toBe(405);
  });
});
