// The map picker: tap the railway where you watch from, and it finds the timing points either
// side (packages/core locate) from OpenStreetMap, through one Overpass query per tap. Loaded
// only when the set-up asks for it, so the watch view stays small.
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { type Located, locate, type OsmElement, overpassQuery } from "@too-too-soon/core";

const OVERPASS = "https://overpass-api.de/api/interpreter";
const STYLE = "https://tiles.openfreemap.org/styles/liberty";
const RAILWAYS = ["a", "b", "c"].map((s) => `https://${s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png`);

export interface Picked {
  a: string;
  b: string;
  f: number;
  aName: string;
  bName: string;
}

async function ask(lat: number, lon: number, radius: number): Promise<OsmElement[]> {
  const r = await fetch(OVERPASS, { method: "POST", body: new URLSearchParams({ data: overpassQuery(lat, lon, radius) }) });
  if (!r.ok) throw new Error(`OpenStreetMap's Overpass answered ${r.status}`);
  return ((await r.json()) as { elements?: OsmElement[] }).elements ?? [];
}

/** Ask nearby first, then further out: timing points can be a few km apart in the country. */
async function find(lat: number, lon: number): Promise<Located | undefined> {
  for (const radius of [3000, 8000]) {
    const found = locate(await ask(lat, lon, radius), { lat, lon });
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
    <div class="pick-actions"><button type="button" id="pick-me" class="ghost">Near me</button><button type="button" id="pick-use" disabled>Use this spot</button></div>`;
  const status = root.querySelector<HTMLElement>("#pick-status")!;
  const use = root.querySelector<HTMLButtonElement>("#pick-use")!;
  const map = new maplibregl.Map({ container: "map", style: STYLE, center: [-1.9, 52.8], zoom: 5.5, attributionControl: { compact: true } });
  map.on("load", () => {
    map.addSource("railways", { type: "raster", tiles: RAILWAYS, tileSize: 256, maxzoom: 19, attribution: '<a href="https://www.openrailwaymap.org/">OpenRailwayMap</a>' });
    map.addLayer({ id: "railways", type: "raster", source: "railways", paint: { "raster-opacity": 0.85 } });
  });
  let markers: maplibregl.Marker[] = [];
  let picked: Picked | undefined;
  let asking = 0;

  map.on("click", async (e) => {
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
      const found = await find(e.lngLat.lat, e.lngLat.lng);
      if (mine !== asking) return;
      if (!found) {
        status.textContent = "Couldn't find a railway track with timing points either side here. Tap right on the track, or type the codes instead.";
        return;
      }
      markers.forEach((m) => m.remove());
      markers = [
        new maplibregl.Marker({ color: "#14532d" }).setLngLat([found.snapped.lon, found.snapped.lat]).addTo(map),
        new maplibregl.Marker({ color: "#a16207", scale: 0.8 }).setLngLat([found.a.lon, found.a.lat]).addTo(map),
        new maplibregl.Marker({ color: "#a16207", scale: 0.8 }).setLngLat([found.b.lon, found.b.lat]).addTo(map),
      ];
      picked = { a: found.a.code, b: found.b.code, f: Math.round(found.f * 100) / 100, aName: found.a.name, bName: found.b.name };
      const km = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);
      status.innerHTML = `Between <b>${esc(found.a.name)}</b> (${km(found.a.along)} away) and <b>${esc(found.b.name)}</b> (${km(found.b.along)} away), on the track's timing points ${esc(found.a.code)} and ${esc(found.b.code)}.`;
      use.disabled = false;
    } catch (err) {
      if (mine === asking) status.textContent = `${(err as Error).message}: try again in a moment.`;
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
