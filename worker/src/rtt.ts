// Talking to Realtime Trains: the token, the location line-up, and what the token may do.
// The only code that knows RTT's host or the token. See docs/architecture.md#the-token-rule.
import type { RttLocationResponse } from "@too-too-soon/core";

export const RTT = "https://data.rtt.io";

export interface Deps {
  fetch: typeof fetch;
  now: () => number;
}

/** RTT said no: its status, and how long to wait when rate-limited. */
export class RttError extends Error {
  status: number;
  retryAfter?: number;
  constructor(status: number, message: string, retryAfter?: number) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

interface Access {
  token: string;
  /** Epoch ms after which it needs refreshing; Infinity for a long-life access token. */
  until: number;
  entitlements?: string[];
}

/**
 * The access token for `secret`. RTT hands out either a long-life access token or a refresh
 * token, and the producer only pastes "the token": so the first time, ask RTT to swap it.
 * If it swaps, it was a refresh token; if not, it's an access token already. Kept for the
 * life of the isolate.
 */
let access: { secret: string; access: Promise<Access> } | undefined;

export function forgetToken(): void {
  access = undefined;
}

export async function accessToken(secret: string, deps: Deps): Promise<Access> {
  // Kept as a promise, so the two line-ups asked for at once share one swap.
  if (access?.secret === secret) {
    const held = await access.access;
    if (held.until > deps.now() + 60_000) return held;
  }
  const pending = swap(secret, deps);
  access = { secret, access: pending };
  // A swap that failed (the network) isn't kept: the next request tries again.
  pending.catch(() => {
    if (access?.access === pending) access = undefined;
  });
  return pending;
}

async function swap(secret: string, deps: Deps): Promise<Access> {
  const r = await deps.fetch(`${RTT}/api/get_access_token`, { headers: { Authorization: `Bearer ${secret}` } });
  if (r.ok) {
    const body = (await r.json().catch(() => ({}))) as { token?: string; validUntil?: string; entitlements?: unknown };
    if (body.token) {
      const until = body.validUntil ? Date.parse(body.validUntil) : NaN;
      return { token: body.token, until: Number.isNaN(until) ? deps.now() + 30 * 60_000 : until, entitlements: entitlementNames(body.entitlements) };
    }
  }
  return { token: secret, until: Infinity };
}

/** RTT's entitlement list, as names: it's a list of strings or of objects with a name. */
export function entitlementNames(e: unknown): string[] | undefined {
  if (!Array.isArray(e)) return e && typeof e === "object" ? Object.keys(e).filter((k) => (e as Record<string, unknown>)[k]) : undefined;
  return e.map((x) => (typeof x === "string" ? x : String((x as { name?: string; entitlement?: string })?.name ?? (x as { entitlement?: string })?.entitlement ?? ""))).filter(Boolean);
}

async function get(path: string, secret: string, deps: Deps): Promise<Response> {
  const { token } = await accessToken(secret, deps);
  const r = await deps.fetch(`${RTT}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  if (r.status === 401) forgetToken();
  return r;
}

/** Minutes before now that a line-up starts: a late train past A may not have reached the spot yet. */
export const LOOK_BACK_MIN = 15;
/** Minutes a line-up covers from its start. */
export const WINDOW_MIN = 120;

/**
 * Whether RTT accepts our time window. "Time window functionality may be limited by your
 * authorisation token", so if it turns the window down once, ask with its default (an hour)
 * from then on.
 */
let windowAllowed = true;

/** The trains at a timing point, from 15 minutes ago, in detailed mode (which lists trains that pass without stopping). */
export async function lineUp(code: string, secret: string, deps: Deps): Promise<RttLocationResponse> {
  const from = new Date(deps.now() - LOOK_BACK_MIN * 60_000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const ask = (withWindow: boolean) => {
    const q = new URLSearchParams({ code, timeFrom: from, detailed: "true" });
    if (withWindow) q.set("timeWindow", String(WINDOW_MIN));
    return get(`/gb-nr/location?${q}`, secret, deps);
  };
  let r = await ask(windowAllowed);
  if (r.status === 400 && windowAllowed) {
    const retry = await ask(false);
    if (retry.ok || retry.status === 204) windowAllowed = false;
    r = retry;
  }
  if (r.status === 204) return { services: [] };
  if (!r.ok) {
    const retry = Number(r.headers.get("Retry-After"));
    throw new RttError(r.status, `RTT answered ${r.status} for ${code}`, Number.isFinite(retry) && retry > 0 ? retry : undefined);
  }
  return (await r.json()) as RttLocationResponse;
}

export interface Info {
  ok: boolean;
  apiVersion?: string;
  entitlements?: string[];
  status: number;
}

/** What the token may do: /api/info. */
export async function info(secret: string, deps: Deps): Promise<Info> {
  const r = await get("/api/info", secret, deps);
  if (!r.ok) return { ok: false, status: r.status };
  const body = (await r.json().catch(() => ({}))) as { api_version?: string; credentials?: { entitlements?: unknown } };
  return { ok: true, status: r.status, apiVersion: body.api_version, entitlements: entitlementNames(body.credentials?.entitlements) };
}
