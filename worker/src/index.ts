// The Worker's entry: the real fetch, clock and cache around handle().
import { type Env, handle, type Store } from "./handle.ts";

/**
 * A Map for the life of the isolate, in front of the Workers Cache API. On a workers.dev
 * address the Cache API does nothing (it needs a custom domain), so for now the cache is
 * the isolate's Map: phones that reach the same isolate share a lookup.
 */
const memory = new Map<string, { value: string; until: number }>();
const store: Store = {
  async get(key) {
    const m = memory.get(key);
    if (m && m.until > Date.now()) return m.value;
    const hit = await caches.default.match(cacheUrl(key));
    if (!hit) return undefined;
    const value = await hit.text();
    memory.set(key, { value, until: Date.now() + 60_000 });
    return value;
  },
  async put(key, value, ttlSeconds) {
    memory.set(key, { value, until: Date.now() + ttlSeconds * 1000 });
    await caches.default.put(cacheUrl(key), new Response(value, { headers: { "Cache-Control": `max-age=${ttlSeconds}` } }));
  },
};
const cacheUrl = (key: string) => `https://cache.too-too-soon.internal/${encodeURIComponent(key)}`;

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handle(request, env, { fetch: (input, init) => fetch(input, init), now: () => Date.now(), store, waitUntil: (p) => ctx.waitUntil(p) });
  },
};
