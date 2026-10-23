// The Worker's routes. Everything it needs from outside (fetch, the clock, the cache) is
// passed in, so the tests run it against recorded responses.
import { type ErrorResponse, type InfoResponse, liveDataLimited, type NextResponse, parseSpot, predictPasses, type RttLocationResponse, upcoming } from "@too-too-soon/core";
import { type Deps, info, lineUp, RttError } from "./rtt.ts";

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
  const raw = await deps.store.get(key);
  const cached: Cached | undefined = raw ? JSON.parse(raw) : undefined;
  if (cached && deps.now() - cached.at < FRESH_MS) return { ...cached, stale: false };
  try {
    const data = await lineUp(code, secret, deps);
    const at = deps.now();
    await deps.store.put(key, JSON.stringify({ at, data } satisfies Cached), KEEP_S);
    return { data, at, stale: false };
  } catch (e) {
    if (cached) return { ...cached, stale: true };
    throw e;
  }
}

async function next(url: URL, env: Env, deps: HandlerDeps): Promise<Response> {
  const parsed = parseSpot(url.searchParams);
  if ("error" in parsed) return json({ error: parsed.error }, 400);
  const { a, b, f } = parsed.spot;
  if (!env.RTT_TOKEN) return json({ error: "The live data isn't set up yet: the Worker has no Realtime Trains token. Try the demo (?demo)." }, 503);
  try {
    const [atA, atB] = await Promise.all([cachedLineUp(a, env.RTT_TOKEN, deps), cachedLineUp(b, env.RTT_TOKEN, deps)]);
    const body: NextResponse = {
      generatedAt: Math.min(atA.at, atB.at),
      passes: upcoming(predictPasses(atA.data, atB.data, f), deps.now()),
      aName: atA.data.query?.location?.description,
      bName: atB.data.query?.location?.description,
    };
    if (atA.stale || atB.stale) body.stale = true;
    if (liveDataLimited(atA.data, atB.data)) body.limited = true;
    return json(body);
  } catch (e) {
    if (e instanceof RttError) {
      const msg =
        e.status === 429 ? "Realtime Trains says we've asked too often: try again in a minute." : e.status === 401 || e.status === 403 ? "Realtime Trains didn't accept the token: check /api/info." : e.status === 400 ? `Realtime Trains didn't understand the request: is "${a}" or "${b}" a real timing point?` : "Realtime Trains didn't answer: try again in a minute.";
      return json({ error: msg }, e.status === 429 ? 429 : 502, e.retryAfter ? { "Retry-After": String(e.retryAfter) } : {});
    }
    throw e;
  }
}

async function infoRoute(env: Env, deps: HandlerDeps): Promise<Response> {
  if (!env.RTT_TOKEN) return json({ configured: false, ok: false, detailed: false, error: "No RTT_TOKEN secret: see the one-time setup." });
  const i = await info(env.RTT_TOKEN, deps);
  return json({
    configured: true,
    ok: i.ok,
    apiVersion: i.apiVersion,
    entitlements: i.entitlements,
    detailed: i.entitlements?.includes("allowDetailed") ?? false,
    error: i.ok ? undefined : `Realtime Trains answered ${i.status}`,
  });
}

export async function handle(request: Request, env: Env, deps: HandlerDeps): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "GET only" }, 405);
  if (url.pathname === "/api/next") return next(url, env, deps);
  if (url.pathname === "/api/info") return infoRoute(env, deps);
  if (url.pathname.startsWith("/api/")) return json({ error: "No such API" }, 404);
  if (env.ASSETS) return env.ASSETS.fetch(request);
  return new Response("Not found", { status: 404 });
}
