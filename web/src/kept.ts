// A static JSON file the site makes at deploy time (places.json, points.json), kept on the phone
// with the Cache API so it's there with a weak signal at the bridge: a kept copy is used at once,
// and a fresh one fetched behind it for next time, so a new deploy's file replaces it.

const CACHE = "too-too-soon-files";

/** What it needs from the browser, so the tests can stand in for it. */
export interface KeptDeps {
  caches?: Pick<CacheStorage, "open">;
  fetch: (url: string) => Promise<Response>;
}

const isJson = (r: Response | undefined): r is Response => !!r?.ok && (r.headers.get("Content-Type") ?? "").includes("json");

/**
 * The file's JSON: the phone's copy if there is one (with a fresh copy fetched behind it), else
 * the site's. Undefined when neither has it, or the site answers with something else (a page, on a
 * host that serves one for every path).
 */
export async function keptJson<T>(url: string, deps: KeptDeps = { caches: globalThis.caches, fetch: (u) => globalThis.fetch(u) }): Promise<T | undefined> {
  let cache: Cache | undefined;
  try {
    cache = await deps.caches?.open(CACHE);
  } catch {
    // No Cache API (an old browser, or not a secure page): just the network.
  }
  const fresh = deps
    .fetch(url)
    .then(async (r) => {
      if (!isJson(r)) return undefined;
      await cache?.put(url, r.clone()).catch(() => undefined);
      return r;
    })
    // Offline: nothing fresh. Caught here, so it's never an unhandled rejection behind a kept copy.
    .catch(() => undefined);
  const kept = await cache?.match(url).catch(() => undefined);
  const r = isJson(kept) ? kept : await fresh;
  return r ? ((await r.json()) as T) : undefined;
}
