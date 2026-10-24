// The map picker: tap the railway where you watch from, and it finds the timing points either
// side (packages/core locate) from OpenStreetMap, through one Overpass query per tap. Loaded
// only when the set-up asks for it, so the watch view stays small.
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre draws vector tiles in a web worker it finds next to its own file, which a bundle
// doesn't have: so Vite bundles the worker (with what it imports) and MapLibre is told where.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { type Located, locate, type OsmElement, overpassQuery } from "@too-too-soon/core";

maplibregl.setWorkerUrl(workerUrl);

/**
 * Public Overpass servers, free and shared: each lets one connection run only a couple of
 * queries at a time and answers 429 ("too many requests") past that. On 429 or a gateway
 * error, try the next.
 */
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"];

/** OpenStreetMap is busy: worth saying plainly, and worth a wait rather than another tap. */
class Busy extends Error {}
const STYLE = "https://tiles.openfreemap.org/styles/liberty";
const RAILWAYS = ["a", "b", "c"].map((s) => `https://${s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png`);

export interface Picked {
  a: string;
  b: string;
  f: number;
  aName: string;
  bName: string;
}

async function ask(lat: number, lon: number, radius: number, signal: AbortSignal): Promise<OsmElement[]> {
  const body = new URLSearchParams({ data: overpassQuery(lat, lon, radius) });
  let last = 0;
  for (const url of OVERPASS) {
    // Overpass can be slow or stuck: give up after 30 s rather than "Looking…" for ever.
    const r = await fetch(url, { method: "POST", body, signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]) });
    if (r.ok) return ((await r.json()) as { elements?: OsmElement[] }).elements ?? [];
    last = r.status;
    if (![429, 502, 503, 504].includes(r.status)) break;
  }
  if ([429, 502, 503, 504].includes(last)) throw new Busy("busy");
  throw new Error(`OpenStreetMap answered ${last}`);
}

/** Ask nearby first, then further out: timing points can be a few km apart in the country. */
async function find(lat: number, lon: number, signal: AbortSignal): Promise<Located | undefined> {
  for (const radius of [3000, 8000]) {
    const found = locate(await ask(lat, lon, radius, signal), { lat, lon });
    if (found) return found;
  }
  return undefined;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Opens the picker in `root`; `done` gets the spot, or undefined on cancel. */
export function openPicker(root: HTMLElement, done: (picked: Picked | undefined) => void): void {
  root.innerHTML = `<header><h1>Tap the railway</h1><button type="button" id="pick-cancel" class="ghost">Cancel</button></header>
    <p class="intro">Zoom in to where you watch trains from and tap the track (the railway lines are drawn on top).</p>
    <div id="map" class="map"></div>
    <p id="pick-status" class="note" aria-live="polite">Tap the track.</p>
    <p id="pick-where" class="where" hidden><span>You tapped <code id="pick-coords"></code></span><button type="button" id="pick-copy" class="ghost small">Copy</button></p>
    <div class="pick-actions"><button type="button" id="pick-me" class="ghost">Near me</button><button type="button" id="pick-use" disabled>Use this spot</button></div>`;
  const status = root.querySelector<HTMLElement>("#pick-status")!;
  const where = root.querySelector<HTMLElement>("#pick-where")!;
  const coords = root.querySelector<HTMLElement>("#pick-coords")!;
  const copy = root.querySelector<HTMLButtonElement>("#pick-copy")!;
  // Every tap shows where it was, as "lat, lon" anyone can paste into a map or a message.
  const showWhere = (lat: number, lon: number) => {
    coords.textContent = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    copy.textContent = "Copy";
    where.hidden = false;
  };
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(coords.textContent ?? "");
      copy.textContent = "Copied";
    } catch {
      // No clipboard (an old browser, or not allowed): select the text so it can be copied by hand.
      getSelection()?.selectAllChildren(coords);
      copy.textContent = "Select and copy";
    }
  });
  const use = root.querySelector<HTMLButtonElement>("#pick-use")!;
  const map = new maplibregl.Map({ container: "map", style: STYLE, center: [-1.9, 52.8], zoom: 5.5, attributionControl: { compact: false } });
  map.on("load", () => {
    map.addSource("railways", { type: "raster", tiles: RAILWAYS, tileSize: 256, maxzoom: 19, attribution: '<a href="https://www.openrailwaymap.org/">OpenRailwayMap</a>' });
    map.addLayer({ id: "railways", type: "raster", source: "railways", paint: { "raster-opacity": 0.85 } });
  });
  let markers: maplibregl.Marker[] = [];
  let picked: Picked | undefined;
  let asking = 0;
  let inFlight: AbortController | undefined;

  map.on("click", async (e) => {
    showWhere(e.lngLat.lat, e.lngLat.lng);
    if (map.getZoom() < 13) {
      map.flyTo({ center: e.lngLat, zoom: 15 });
      status.textContent = "Closer in, then tap the track.";
      return;
    }
    const mine = ++asking;
    picked = undefined;
    use.disabled = true;
    markers.forEach((m) => m.remove());
    markers = [new maplibregl.Marker({ color: "#64748b" }).setLngLat(e.lngLat).addTo(map)];
    status.textContent = "Looking along the track…";
    try {
      // A new tap cancels the last one's lookup, so taps don't pile up against the server's limit.
      inFlight?.abort();
      inFlight = new AbortController();
      const found = await find(e.lngLat.lat, e.lngLat.lng, inFlight.signal);
      if (mine !== asking) return;
      if (!found) {
        status.textContent = "Couldn't find a railway track with timing points either side here. Tap right on the track, or type the codes instead.";
        return;
      }
      markers.forEach((m) => m.remove());
      const label = (text: string) => {
        const el = document.createElement("div");
        el.className = "map-label";
        el.textContent = text;
        return el;
      };
      markers = [
        new maplibregl.Marker({ color: "#14532d" }).setLngLat([found.snapped.lon, found.snapped.lat]).addTo(map),
        new maplibregl.Marker({ element: label(`A · ${found.a.name}`) }).setLngLat([found.a.lon, found.a.lat]).addTo(map),
        new maplibregl.Marker({ element: label(`B · ${found.b.name}`) }).setLngLat([found.b.lon, found.b.lat]).addTo(map),
      ];
      map.fitBounds(
        [
          [Math.min(found.a.lon, found.b.lon), Math.min(found.a.lat, found.b.lat)],
          [Math.max(found.a.lon, found.b.lon), Math.max(found.a.lat, found.b.lat)],
        ],
        { padding: 60, maxZoom: 16 },
      );
      picked = { a: found.a.code, b: found.b.code, f: Math.round(found.f * 100) / 100, aName: found.a.name, bName: found.b.name };
      const km = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);
      status.innerHTML = `Between <b>${esc(found.a.name)}</b> (${km(found.a.along)} away) and <b>${esc(found.b.name)}</b> (${km(found.b.along)} away), on the track's timing points ${esc(found.a.code)} and ${esc(found.b.code)}.`;
      use.disabled = false;
    } catch (err) {
      if (mine !== asking || (err as Error).name === "AbortError") return;
      status.textContent =
        err instanceof Busy
          ? "OpenStreetMap is busy (it's a free service, shared by everyone): wait half a minute, then tap again. The coordinates above work meanwhile."
          : (err as Error).name === "TimeoutError"
            ? "OpenStreetMap is slow to answer just now: try again in a moment."
            : `${(err as Error).message}: try again in a moment.`;
    }
  });

  root.querySelector("#pick-me")!.addEventListener("click", () => {
    navigator.geolocation?.getCurrentPosition(
      (p) => map.flyTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 15 }),
      () => (status.textContent = "Couldn't get your location: zoom in by hand."),
    );
  });
  const close = (result: Picked | undefined) => {
    map.remove();
    done(result);
  };
  use.addEventListener("click", () => picked && close(picked));
  root.querySelector("#pick-cancel")!.addEventListener("click", () => close(undefined));
}
