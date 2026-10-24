// The Worker's routes. Everything it needs from outside (fetch, the clock, the cache) is
// passed in, so the tests run it against recorded responses.
import { type ErrorResponse, type InfoResponse, liveDataLimited, type NextResponse, type Pass, parseSpot, predictPasses, type RttLocationResponse, trainClassOf, upcoming } from "@too-too-soon/core";
import { osm } from "./osm.ts";
import { accessToken, type Deps, info, lineUp, RttError, service, tidyToken } from "./rtt.ts";

export interface Env {
  /** The Realtime Trains token (access or refresh): a Worker secret, set by the deploy workflow. */
  RTT_TOKEN?: string;
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
}

/** A small key-value cache with expiry: the Workers Cache API in production, a Map in tests. */
export interface Store {
  get(key: string): Promise<string | undefined>;
  put(key: string, value: string, ttlSeconds: number): Promise<void>;
}

export interface HandlerDeps extends Deps {
  store: Store;
  /** Lets work finish after the answer's sent (the Worker's ctx.waitUntil). */
  waitUntil?: (p: Promise<unknown>) => void;
}

/** A line-up is fresh for a minute: several phones at one bridge share one lookup. */
export const FRESH_MS = 60_000;
/** After that it's kept for half an hour, to show (marked stale) when RTT can't be asked. */
export const KEEP_S = 30 * 60;

interface Cached {
  at: number;
  data: RttLocationResponse;
}

const json = (body: NextResponse | ErrorResponse | InfoResponse, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra } });

/** A timing point's line-up: from the cache if it's fresh, from RTT if not, or the last good one if RTT fails. */
async function cachedLineUp(code: string, secret: string, deps: HandlerDeps): Promise<{ data: RttLocationResponse; at: number; stale: boolean }> {
  const key = `lineup:${code}`;
  const raw = await deps.store.get(key).catch(() => undefined);
  let cached: Cached | undefined;
  try {
    cached = raw ? JSON.parse(raw) : undefined;
  } catch {
    cached = undefined;
  }
  if (cached && deps.now() - cached.at < FRESH_MS) return { ...cached, stale: false };
  try {
    const data = await lineUp(code, secret, deps);
    const at = deps.now();
    await deps.store.put(key, JSON.stringify({ at, data } satisfies Cached), KEEP_S).catch(() => undefined);
    return { data, at, stale: false };
  } catch (e) {
    if (cached) return { ...cached, stale: true };
    throw e;
  }
}

/** Line-ups being fetched right now, so two phones that miss the cache together share one lookup. */
const inFlight = new Map<string, Promise<{ data: RttLocationResponse; at: number; stale: boolean }>>();

function sharedLineUp(code: string, secret: string, deps: HandlerDeps) {
  let p = inFlight.get(code);
  if (!p) {
    p = cachedLineUp(code, secret, deps).finally(() => inFlight.delete(code));
    inFlight.set(code, p);
  }
  return p;
}

/** How many of the next passenger trains get their class of train: one RTT lookup each, the first time. */
export const CLASS_AHEAD = 6;
/** A train's class is kept for six hours once known (it rarely changes), an hour when RTT doesn't say. */
export const CLASS_KEEP_S = 6 * 3600;
export const NO_CLASS_KEEP_S = 3600;
/** A lookup that failed (not a 429) isn't tried again for ten minutes. */
export const FAILED_CLASS_KEEP_S = 600;
/** The list waits at most this long for classes; any not back by then come on a later refresh. */
export const CLASS_WAIT_MS = 1500;
/** After RTT says we've asked too often, no class lookups for at least this long (longer if its Retry-After says). */
export const CLASS_PAUSE_MS = 10 * 60_000;

/** Class lookups are paused until then: they're extras, and mustn't spend what the line-ups need. */
let classesPausedUntil = 0;
/** Class lookups under way, so phones asking together share one per train. */
const classInFlight = new Map<string, Promise<string | undefined>>();
export const resetClasses = () => {
  classesPausedUntil = 0;
  classInFlight.clear();
};

/** One train's class: from the cache, or one lookup shared by everyone asking; undefined when unknown for now. */
async function classOf(p: Pass, secret: string, deps: HandlerDeps): Promise<string | undefined> {
  const key = `class:${p.id}:${p.allocationIndex ?? 0}`;
  const cached = await deps.store.get(key).catch(() => undefined);
  if (cached !== undefined) return cached || undefined;
  if (deps.now() < classesPausedUntil) return undefined;
  let pending = classInFlight.get(key);
  if (!pending) {
    pending = (async () => {
      try {
        const cls = trainClassOf(await service(p.id, secret, deps), p.allocationIndex) ?? "";
        await deps.store.put(key, cls, cls ? CLASS_KEEP_S : NO_CLASS_KEEP_S).catch(() => undefined);
        return cls || undefined;
      } catch (e) {
        if (e instanceof RttError && e.status === 429) classesPausedUntil = deps.now() + Math.max(CLASS_PAUSE_MS, (e.retryAfter ?? 0) * 1000);
        // Anything else (a 404, a 5xx, the network): remembered as unknown for a while, not asked again every refresh.
        else await deps.store.put(key, "", FAILED_CLASS_KEEP_S).catch(() => undefined);
        return undefined;
      }
    })().finally(() => classInFlight.delete(key));
    classInFlight.set(key, pending);
  }
  return pending;
}

/**
 * The class of train ("444") for the next few passenger trains, from RTT's allocations: only
 * with an entitlement for them, each train asked about once (then cached), never holding the
 * list up for more than CLASS_WAIT_MS (lookups still going carry on, via waitUntil, and are
 * cached for the next refresh), and not at all for a while after a 429.
 */
async function withClasses(passes: Pass[], secret: string, deps: HandlerDeps): Promise<Pass[]> {
  const found = new Map<string, string>();
  const lookups = passes
    .filter((p) => p.passenger)
    .slice(0, CLASS_AHEAD)
    .map(async (p) => {
      const cls = await classOf(p, secret, deps);
      if (cls) found.set(p.id, cls);
    });
  const all = Promise.all(lookups);
  deps.waitUntil?.(all);
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([all, new Promise((done) => (timer = setTimeout(done, CLASS_WAIT_MS)))]);
  if (timer !== undefined) clearTimeout(timer);
  return passes.map((p) => (found.has(p.id) ? { ...p, trainClass: found.get(p.id) } : p));
}

/** Whatever went wrong, the page gets JSON it can show, never the platform's error page. */
function failure(e: unknown, a: string, b: string): Response {
  if (e instanceof RttError) {
    const msg =
      e.status === 429 ? "Realtime Trains says we've asked too often: try again in a minute." : e.status === 401 || e.status === 403 ? "Realtime Trains didn't accept the token: check /api/info." : e.status === 400 ? `Realtime Trains didn't understand the request: is "${a}" or "${b}" a real timing point?` : "Realtime Trains didn't answer: try again in a minute.";
    return json({ error: msg }, e.status === 429 ? 429 : 502, e.retryAfter ? { "Retry-After": String(e.retryAfter) } : {});
  }
  console.error("api/next failed", e);
  return json({ error: "Couldn't get the trains just now: try again in a minute." }, 502);
}

async function next(url: URL, env: Env, deps: HandlerDeps): Promise<Response> {
  const parsed = parseSpot(url.searchParams);
  if ("error" in parsed) return json({ error: parsed.error }, 400);
  const { a, b, f } = parsed.spot;
  if (!env.RTT_TOKEN) return json({ error: "The live data isn't set up yet: the Worker has no Realtime Trains token. Try the demo (?demo)." }, 503);
  try {
    const [atA, atB] = await Promise.all([sharedLineUp(a, env.RTT_TOKEN, deps), sharedLineUp(b, env.RTT_TOKEN, deps)]);
    // A swapped token says what it may do: detailed mode lists trains that pass without calling,
    // and an allocations entitlement says what each train is.
    const ents = await accessToken(env.RTT_TOKEN, deps).then((t) => t.entitlements).catch(() => undefined);
    let passes = upcoming(predictPasses(atA.data, atB.data, f), deps.now());
    // Not while RTT is turning the line-ups down: the classes can wait.
    if (!atA.stale && !atB.stale && ents?.some((e) => e.startsWith("allowAllocations"))) passes = await withClasses(passes, env.RTT_TOKEN, deps);
    const body: NextResponse = {
      generatedAt: Math.min(atA.at, atB.at),
      passes,
      aName: atA.data.query?.location?.description,
      bName: atB.data.query?.location?.description,
    };
    if (atA.stale || atB.stale) body.stale = true;
    if (liveDataLimited(atA.data, atB.data)) body.limited = true;
    if (ents && !ents.includes("allowDetailed")) body.stoppingOnly = true;
    return json(body);
  } catch (e) {
    return failure(e, a, b);
  }
}

/** /api/info is public, so its answer is kept for five minutes: nobody can spend the quota on it. */
let infoCache: { at: number; body: InfoResponse } | undefined;
export const resetInfo = () => (infoCache = undefined);

async function infoRoute(env: Env & { tidied?: boolean }, deps: HandlerDeps): Promise<Response> {
  if (!env.RTT_TOKEN) return json({ configured: false, ok: false, detailed: false, error: "No RTT_TOKEN secret: see the one-time setup." });
  if (infoCache && deps.now() - infoCache.at < 5 * 60_000) return json(infoCache.body);
  let i: Awaited<ReturnType<typeof info>>;
  try {
    i = await info(env.RTT_TOKEN, deps);
  } catch (e) {
    return json({ configured: true, ok: false, detailed: false, error: e instanceof RttError ? `Realtime Trains answered ${e.status}` : "Couldn't reach Realtime Trains" }, 502);
  }
  const body: InfoResponse = {
    configured: true,
    ok: i.ok,
    apiVersion: i.apiVersion,
    entitlements: i.entitlements,
    detailed: i.entitlements?.includes("allowDetailed") ?? false,
    error: i.ok ? undefined : `Realtime Trains answered ${i.status}`,
    token: { kind: i.kind, swapStatus: i.swapStatus, tidied: env.tidied || undefined },
    rttSays: i.rttSays,
  };
  if (i.ok) infoCache = { at: deps.now(), body };
  return json(body);
}

export async function handle(request: Request, rawEnv: Env, deps: HandlerDeps): Promise<Response> {
  const url = new URL(request.url);
  const tidy = rawEnv.RTT_TOKEN ? tidyToken(rawEnv.RTT_TOKEN) : undefined;
  const env: Env & { tidied?: boolean } = { ...rawEnv, RTT_TOKEN: tidy?.token || undefined, tidied: tidy?.tidied };
  const api = url.pathname.startsWith("/api/");
  if (request.method !== "GET" && !(request.method === "HEAD" && !api)) return json({ error: "GET only" }, 405);
  if (url.pathname === "/api/next") return next(url, env, deps);
  if (url.pathname === "/api/info") return infoRoute(env, deps);
  if (url.pathname === "/api/osm") return osm(url, deps.fetch);
  if (api) return json({ error: "No such API" }, 404);
  if (env.ASSETS) return env.ASSETS.fetch(request);
  return new Response("Not found", { status: 404 });
}
