// The Worker's entry: the real fetch, clock and cache around handle().
import { type Env, handle, type Store } from "./handle.ts";

/** The Workers Cache API as a Store, behind a Map for the life of the isolate. */
const memory = new Map<string, { value: string; until: number }>();
const store: Store = {
  async get(key) {
    const m = memory.get(key);
    if (m && m.until > Date.now()) return m.value;
    const hit = await caches.default.match(cacheUrl(key));
    return hit ? hit.text() : undefined;
  },
  async put(key, value, ttlSeconds) {
    memory.set(key, { value, until: Date.now() + ttlSeconds * 1000 });
    await caches.default.put(cacheUrl(key), new Response(value, { headers: { "Cache-Control": `max-age=${ttlSeconds}` } }));
  },
};
const cacheUrl = (key: string) => `https://cache.too-too-soon.internal/${encodeURIComponent(key)}`;

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, env, { fetch: (input, init) => fetch(input, init), now: () => Date.now(), store });
  },
};
