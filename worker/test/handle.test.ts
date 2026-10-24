import { beforeEach, describe, expect, it } from "vitest";
import { type DemoTrain, type InfoResponse, lineUps, type NextResponse } from "@too-too-soon/core";
import { CLASS_PAUSE_MS, FRESH_MS, handle, resetClasses, resetInfo, type Store } from "../src/handle.ts";
import { resetRtt } from "../src/rtt.ts";

const NOW = Date.parse("2026-10-24T14:00:00Z");
const train = (over: Partial<DemoTrain>): DemoTrain => ({ id: "X1", headcode: "1X01", at: 10, direction: "ab", run: 4, origin: "Here", destination: "There", ...over });

/** A fake RTT: answers the line-ups for `trains`, or `status` for every location call. */
function fakeRtt(opts: { trains?: DemoTrain[]; status?: number; refresh?: boolean; swapStatus?: number; entitlements?: unknown; swapEntitlements?: string[]; serviceStatus?: number; retryAfter?: number; noWindow?: boolean; down?: boolean } = {}) {
  const calls: { url: string; auth: string | null }[] = [];
  let clock = NOW;
  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const auth = new Headers(init?.headers).get("Authorization");
    calls.push({ url: url.toString(), auth });
    if (opts.down) throw new TypeError("network down");
    if (url.pathname === "/api/get_access_token") {
      if (opts.swapStatus) return new Response(null, { status: opts.swapStatus });
      return opts.refresh ? Response.json({ token: "short-life", validUntil: new Date(clock + 3600_000).toISOString(), entitlements: opts.swapEntitlements ?? ["allowDetailed"] }) : new Response("no", { status: 403 });
    }
    if (url.pathname === "/api/info") return Response.json({ api_version: "2026-10-01", credentials: { entitlements: opts.entitlements ?? ["allowDetailed"] } });
    if (url.pathname === "/gb-nr/location") {
      if (opts.noWindow && url.searchParams.has("timeWindow")) return new Response(null, { status: 400 });
      if (opts.status) return new Response(null, { status: opts.status, headers: opts.status === 429 ? { "Retry-After": "30" } : {} });
      const ups = lineUps(opts.trains ?? [train({})], clock);
      return Response.json(url.searchParams.get("code") === "ASHBYJN" ? ups.a : ups.b);
    }
    if (url.pathname === "/gb-nr/service") {
      if (opts.serviceStatus) return new Response(null, { status: opts.serviceStatus, headers: opts.serviceStatus === 429 && opts.retryAfter ? { "Retry-After": String(opts.retryAfter) } : {} });
      const t = (opts.trains ?? [train({})]).find((x) => url.searchParams.get("uniqueIdentity")?.startsWith(`${x.id}:`));
      return Response.json({ service: { allocationData: t?.trainClass ? [{ allocationIndex: 0, leadingClass: t.trainClass, passengerVehicles: t.coaches }] : [] } });
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

beforeEach(() => {
  resetRtt();
  resetInfo();
  resetClasses();
});

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
    expect(loc.searchParams.get("timeWindow")).toBe("120");
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
  it("says when only stopping trains can be listed", async () => {
    const rtt = fakeRtt({ refresh: true });
    const fetch = rtt.deps.fetch;
    rtt.deps.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes("get_access_token") ? Response.json({ token: "t", validUntil: new Date(NOW + 3600_000).toISOString(), entitlements: [] }) : fetch(input, init)) as typeof globalThis.fetch;
    expect(((await (await handle(get(SPOT), env, rtt.deps)).json()) as NextResponse).stoppingOnly).toBe(true);
    resetRtt();
    const detailed = fakeRtt({ refresh: true });
    expect(((await (await handle(get(SPOT), env, detailed.deps)).json()) as NextResponse).stoppingOnly).toBeUndefined();
  });
  it("swaps the refresh token again once the access token runs out", async () => {
    const rtt = fakeRtt({ refresh: true });
    await handle(get(SPOT), env, rtt.deps);
    rtt.tick(3600_000);
    await handle(get(SPOT), env, rtt.deps);
    expect(rtt.calls.filter((c) => c.url.includes("get_access_token"))).toHaveLength(2);
  });
  it("doesn't take a rate-limited swap to mean an access token", async () => {
    const rtt = fakeRtt({ swapStatus: 429 });
    const r = await handle(get(SPOT), env, rtt.deps);
    expect(r.status).toBe(429);
    expect(rtt.calls.some((c) => c.url.includes("/gb-nr/location"))).toBe(false);
  });
  it("answers JSON, never the platform's error page, when the network fails", async () => {
    const r = await handle(get(SPOT), env, fakeRtt({ down: true }).deps);
    expect(r.status).toBe(502);
    expect(r.headers.get("Content-Type")).toContain("json");
    expect(((await r.json()) as { error: string }).error).toMatch(/try again/);
  });
  it("forgets a token RTT turns down, and swaps again next time", async () => {
    const rtt = fakeRtt({ refresh: true, status: 401 });
    expect((await handle(get(SPOT), env, rtt.deps)).status).toBe(502);
    await handle(get(SPOT), env, rtt.deps);
    expect(rtt.calls.filter((c) => c.url.includes("get_access_token")).length).toBeGreaterThan(1);
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

describe("/api/next, the class of train", () => {
  const trains = [train({ id: "P1", trainClass: "444", coaches: 10 }), train({ id: "P2", at: 20, trainClass: "159" }), train({ id: "F1", at: 30, passenger: false, headcode: "6M41" })];
  const services = (calls: { url: string }[]) => calls.filter((c) => c.url.includes("/gb-nr/service"));

  it("says it for passenger trains, with an allocations entitlement, asking once per train", async () => {
    const rtt = fakeRtt({ trains, refresh: true, swapEntitlements: ["allowDetailed", "allowAllocationsPassenger"] });
    const body = (await (await handle(get(SPOT), env, rtt.deps)).json()) as NextResponse;
    expect(body.passes.map((p) => [p.id.split(":")[1], p.trainClass])).toEqual([["P1", "444"], ["P2", "159"], ["F1", undefined]]);
    // The service is asked for without its namespace.
    expect(services(rtt.calls).map((c) => new URL(c.url).searchParams.get("uniqueIdentity"))).toEqual(["P1:2026-10-24", "P2:2026-10-24"]);
    rtt.tick(FRESH_MS + 1);
    await handle(get(SPOT), env, rtt.deps);
    expect(services(rtt.calls)).toHaveLength(2);
  });
  it("doesn't ask without the entitlement", async () => {
    const rtt = fakeRtt({ trains, refresh: true });
    const body = (await (await handle(get(SPOT), env, rtt.deps)).json()) as NextResponse;
    expect(body.passes.every((p) => p.trainClass === undefined)).toBe(true);
    expect(services(rtt.calls)).toHaveLength(0);
  });
  it("still lists the trains when the lookup fails, and doesn't ask again every refresh", async () => {
    for (const status of [404, 500]) {
      resetClasses();
      const rtt = fakeRtt({ trains, refresh: true, swapEntitlements: ["allowAllocations"], serviceStatus: status });
      const r = await handle(get(SPOT), env, rtt.deps);
      expect(r.status).toBe(200);
      expect(((await r.json()) as NextResponse).passes).toHaveLength(3);
      for (let i = 0; i < 5; i++) await handle(get(SPOT), env, rtt.deps);
      expect(services(rtt.calls)).toHaveLength(2);
    }
  });
  it("shares a lookup between phones asking at once", async () => {
    const rtt = fakeRtt({ trains, refresh: true, swapEntitlements: ["allowAllocations"] });
    await Promise.all([1, 2, 3].map(() => handle(get(SPOT), env, rtt.deps)));
    expect(services(rtt.calls)).toHaveLength(2);
  });
  it("doesn't look up classes while RTT is turning the line-ups down", async () => {
    const rtt = fakeRtt({ trains, refresh: true, swapEntitlements: ["allowAllocations"] });
    rtt.fail(429);
    rtt.deps.store.put("lineup:ASHBYJN", JSON.stringify({ at: NOW - FRESH_MS - 1, data: lineUps(trains, NOW).a }), 60);
    rtt.deps.store.put("lineup:BRAMFD", JSON.stringify({ at: NOW - FRESH_MS - 1, data: lineUps(trains, NOW).b }), 60);
    const body = (await (await handle(get(SPOT), env, rtt.deps)).json()) as NextResponse;
    expect(body.stale).toBe(true);
    expect(services(rtt.calls)).toHaveLength(0);
  });
  it("stops asking for a while after RTT says we've asked too often", async () => {
    const rtt = fakeRtt({ trains, refresh: true, swapEntitlements: ["allowAllocations"], serviceStatus: 429 });
    await handle(get(SPOT), env, rtt.deps);
    const asked = services(rtt.calls).length;
    rtt.tick(FRESH_MS + 1);
    await handle(get(SPOT), env, rtt.deps);
    expect(services(rtt.calls)).toHaveLength(asked);
    rtt.tick(CLASS_PAUSE_MS);
    await handle(get(SPOT), env, rtt.deps);
    expect(services(rtt.calls).length).toBeGreaterThan(asked);
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
  it("is kept for five minutes, so nobody can spend the quota on it", async () => {
    const rtt = fakeRtt();
    await handle(get("/api/info"), env, rtt.deps);
    await handle(get("/api/info"), env, rtt.deps);
    expect(rtt.calls.filter((c) => c.url.includes("/api/info"))).toHaveLength(1);
  });
  it("answers JSON when RTT can't be reached", async () => expect((await handle(get("/api/info"), env, fakeRtt({ down: true }).deps)).status).toBe(502));
  it("tidies a token pasted with a Bearer prefix and a newline, and says so", async () => {
    const rtt = fakeRtt();
    const r = await handle(get("/api/info"), { RTT_TOKEN: "Bearer secret-token\n" }, rtt.deps);
    expect(rtt.calls.every((c) => c.auth === "Bearer secret-token")).toBe(true);
    expect(((await r.json()) as InfoResponse).token).toEqual({ kind: "access", swapStatus: 403, tidied: true });
  });
  it("says what RTT said when it turns the token down, with the token scrubbed out", async () => {
    const rtt = fakeRtt();
    const fetch = rtt.deps.fetch;
    rtt.deps.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes("/api/info") ? new Response("Invalid token secret-token supplied", { status: 401 }) : fetch(input, init)) as typeof globalThis.fetch;
    const body = (await (await handle(get("/api/info"), env, rtt.deps)).json()) as InfoResponse;
    expect(body).toMatchObject({ ok: false, rttSays: "Invalid token … supplied", token: { kind: "access", swapStatus: 403 } });
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
