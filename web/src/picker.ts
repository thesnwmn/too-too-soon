// The map picker: tap the railway where you watch from, and it finds the timing points either
// side (packages/core locate): the track from the map's own tiles and the timing points from the
// dots (track.ts, picker-offline), or, where the tiles have no rail, from OpenStreetMap, asked
// through the Worker's /api/osm. And the dots (find-on-map): every station from points.json, and
// the other timing points behind a switch (timing-toggle), which a tap shows on a card, to fill a
// box on the set-up form; "Find on map" opens it for one box. Loaded only when the set-up asks
// for it, so the watch view stays small.
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre draws vector tiles in a web worker it finds next to its own file, which a bundle
// doesn't have: so Vite bundles the worker (with what it imports) and MapLibre is told where.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { codeLabel, KIND_TEXT, type Located, locate, type MapPoint, mapCentre, type OsmElement, overpassQuery, pointsGeoJson } from "@too-too-soon/core";
import type { Filled } from "./fill.ts";
import { loadMapPoints } from "./points.ts";
import { othersNeeded, othersOn, setOthersOn, splitDots } from "./toggle.ts";
import { findOnTiles, nameOnTiles, type TileSource } from "./track.ts";

/** localStorage, or nothing when the browser blocks it (private browsing). */
function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

maplibregl.setWorkerUrl(workerUrl);

/** The map's vector tiles (the style's source with the `transportation` layer), to find the track in. */
function tileSource(map: maplibregl.Map): TileSource | undefined {
  const layer = map.getStyle().layers.find((l) => "source-layer" in l && l["source-layer"] === "transportation");
  const id = layer && "source" in layer ? layer.source : undefined;
  const src = id ? (map.getSource(id) as maplibregl.VectorTileSource | undefined) : undefined;
  return src?.tiles?.[0] ? { template: src.tiles[0], maxzoom: src.maxzoom } : undefined;
}

/** Straight to Overpass, only where there's no Worker (the demo on GitHub Pages). */
const OVERPASS = "https://overpass-api.de/api/interpreter";

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
  /** The road crossing the line there, to name the spot after (auto-name), when the tiles have one. */
  road?: string;
}

export interface PickerOptions {
  /** Find on map for this box: tapping the track does nothing, and a dot's card says "Use this". */
  box?: "a" | "b";
  /** What the box says on the form, for the header: "Timing point B". */
  label?: string;
  /** The codes the form and the spot hold, to open the map on (mapCentre). */
  a?: string;
  b?: string;
  spotA?: string;
  spotB?: string;
}

/**
 * The dots' credits, beside OpenStreetMap's, in the Open Government Licence's own words: NaPTAN's
 * for the stations, Network Rail's for the other timing points (shown only while they are, as
 * their source's credit), and Realtime Trains for the names.
 */
const CREDIT_STATIONS = "Contains public sector information licensed under the Open Government Licence v3.0";
const CREDIT_OTHERS = "Contains information of Network Rail Infrastructure Limited licensed under the Open Government Licence v3.0";
const CREDIT_NAMES = "Names: Realtime Trains";
const KIND_COLOUR = { station: "#124a28", junction: "#b45309", other: "#64748b" };

async function ask(lat: number, lon: number, radius: number, signal: AbortSignal): Promise<OsmElement[]> {
  // The Worker gives each of three Overpass servers 25 s; give up after 80 s rather than
  // "Looking…" for ever.
  const timeout = AbortSignal.any([signal, AbortSignal.timeout(80_000)]);
  const q = new URLSearchParams({ lat: lat.toFixed(5), lon: lon.toFixed(5), radius: String(radius) });
  let r = await fetch(`api/osm?${q}`, { signal: timeout });
  if (r.status === 404 && !(r.headers.get("Content-Type") ?? "").includes("json")) {
    r = await fetch(OVERPASS, { method: "POST", body: new URLSearchParams({ data: overpassQuery(lat, lon, radius) }), signal: timeout });
  }
  if (r.ok) return ((await r.json()) as { elements?: OsmElement[] }).elements ?? [];
  if ([429, 502, 503, 504].includes(r.status)) throw new Busy("busy");
  throw new Error(`OpenStreetMap answered ${r.status}`);
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

/** Opens the picker in `root`; `done` gets the spot (a track tap), a box filled from a dot, or undefined on cancel. */
export function openPicker(root: HTMLElement, opts: PickerOptions, done: (result: Picked | Filled | undefined) => void): void {
  const finding = opts.box !== undefined;
  // One screen, no scrolling: the map takes whatever height the rest leaves (see .picking in the CSS).
  document.body.classList.add("picking");
  root.innerHTML = `<header><h1>${finding ? `Find ${esc(opts.label ?? "a place")}` : "Tap the railway"}</h1><button type="button" id="pick-cancel" class="ghost">Cancel</button></header>
    <div class="map-wrap"><div id="map" class="map"></div>
      <label class="map-switch" hidden><input type="checkbox" id="pick-others"> Junctions and timing points</label>
      <div id="pick-card" class="pick-card" role="dialog" aria-labelledby="card-name" hidden></div></div>
    <p id="pick-status" class="note" aria-live="polite">${finding ? "Loading the stations and timing points…" : "Tap a dot to use it, or zoom in to where you watch from and tap the track."}</p>
    <div class="pick-actions">
      <button type="button" id="pick-me" class="ghost">Near me</button>
      <button type="button" id="pick-copy" class="ghost icon"${finding ? " hidden" : ""} disabled aria-label="Copy where you tapped" title="Copy where you tapped"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg></button>
      ${finding ? "" : `<button type="button" id="pick-use" disabled>Use this spot</button>`}
    </div>`;
  const status = root.querySelector<HTMLElement>("#pick-status")!;
  const copy = root.querySelector<HTMLButtonElement>("#pick-copy")!;
  // Every tap remembers where it was, as "lat, lon" anyone can paste into a map or a message.
  let where = "";
  const showWhere = (lat: number, lon: number) => {
    where = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    copy.disabled = false;
  };
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(where);
      status.textContent = `Copied ${where}`;
    } catch {
      // No clipboard (an old browser, or not allowed): show it to copy by hand.
      window.prompt("Where you tapped:", where);
    }
  });
  // Find on map has no "Use this spot": a stand-in keeps the track code below simple.
  const use = root.querySelector<HTMLButtonElement>("#pick-use") ?? document.createElement("button");
  let byCode = new Map<string, MapPoint>();
  // The dots a track tap can find: the stations, and the others while they show.
  let walkable = { stations: [] as MapPoint[], others: [] as MapPoint[] };
  let closed = false;
  const map = new maplibregl.Map({ container: "map", style: STYLE, center: [-1.9, 52.8], zoom: 5.5, attributionControl: { customAttribution: CREDIT_NAMES } });
  // On a phone the credits start open, then fold into an ⓘ (tap to read them again) at the first
  // tap, zoom or move of yours: MapLibre folds them only on a drag, and they're several lines.
  const foldCredits = (e: { originalEvent?: unknown }) => {
    if (!e.originalEvent) return;
    map.getContainer().querySelector(".maplibregl-compact-show")?.classList.remove("maplibregl-compact-show");
    for (const ev of ["click", "movestart"] as const) map.off(ev, foldCredits);
  };
  for (const ev of ["click", "movestart"] as const) map.on(ev, foldCredits);
  const dotsReady = loadMapPoints();
  map.on("load", async () => {
    map.addSource("railways", { type: "raster", tiles: RAILWAYS, tileSize: 256, maxzoom: 19, attribution: '<a href="https://www.openrailwaymap.org/">OpenRailwayMap</a>' });
    map.addLayer({ id: "railways", type: "raster", source: "railways", paint: { "raster-opacity": 0.85 } });
    const dots = await dotsReady;
    if (closed) return;
    if (!dots.length) {
      status.textContent = finding
        ? "The stations and timing points aren't on this map here (no signal, or the demo): type the place's name instead."
        : "Zoom in to where you watch from and tap the track.";
      return;
    }
    // Two sets: the stations, and the other timing points behind the switch (BPLAN places them
    // badly). Each gathers into its own clusters, so a hidden set's points aren't counted.
    // Zoomed out, nearby dots gather into one with a count; zoomed in, each is a dot, coloured by kind, then named.
    const addSet = (set: "stations" | "others", points: MapPoint[], attribution: string, visible: boolean) => {
      const visibility = visible ? "visible" : "none";
      map.addSource(set, { type: "geojson", data: pointsGeoJson(points), cluster: true, clusterMaxZoom: 10, clusterRadius: 40, attribution });
      const colour = set === "stations" ? KIND_COLOUR.station : KIND_COLOUR.other;
      // The others' clusters sit up and to the right of the stations', so both counts show where they'd overlap.
      const nudge: [number, number] = set === "stations" ? [0, 0] : [14, -14];
      map.addLayer({ id: `${set}-clusters`, type: "circle", source: set, filter: ["has", "point_count"], layout: { visibility }, paint: { "circle-color": colour, "circle-opacity": 0.75, "circle-radius": ["step", ["get", "point_count"], 12, 20, 16, 100, 21], "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.5, "circle-translate": nudge } });
      map.addLayer({ id: `${set}-count`, type: "symbol", source: set, filter: ["has", "point_count"], layout: { visibility, "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Regular"], "text-size": 12 }, paint: { "text-color": "#ffffff", "text-translate": nudge } });
      map.addLayer({
        id: set,
        type: "circle",
        source: set,
        filter: ["!", ["has", "point_count"]],
        layout: { visibility },
        paint: {
          "circle-color": ["match", ["get", "kind"], "station", KIND_COLOUR.station, "junction", KIND_COLOUR.junction, KIND_COLOUR.other],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, ["match", ["get", "kind"], "station", 5, 3.5], 15, ["match", ["get", "kind"], "station", 9, 7]],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
        },
      });
      map.addLayer({ id: `${set}-names`, type: "symbol", source: set, filter: ["!", ["has", "point_count"]], minzoom: 12, layout: { visibility, "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 12, "text-offset": [0, 0.9], "text-anchor": "top", "text-optional": true }, paint: { "text-color": "#0f172a", "text-halo-color": "#ffffff", "text-halo-width": 1.5 } });
    };
    const showOthers = othersOn(storage());
    const { stations, others } = splitDots(dots);
    walkable = { stations, others };
    addSet("stations", stations, CREDIT_STATIONS, true);
    addSet("others", others, CREDIT_OTHERS, showOthers);
    toggle.checked = showOthers;
    toggle.closest("label")!.hidden = false;
    byCode = new Map(dots.map((d) => [d.code, d]));
    // Open on the other box's place (so B is found near A), else this box's, else the spot; else near you if you've allowed it before.
    const centre = mapCentre((c) => byCode.get(c), opts);
    if (centre) map.jumpTo({ center: [centre.lon, centre.lat], zoom: 13 });
    else void nearMeIfAllowed();
    status.textContent = finding ? "Tap a dot to see what it is, then Use this." : "Tap a dot to use it, or zoom in to where you watch from and tap the track.";
    // A box (or the spot) already holding a junction: show the others, so its dot is there (this visit only).
    if (!showOthers && othersNeeded((c) => byCode.get(c)?.kind, [opts.a, opts.b, opts.spotA, opts.spotB])) {
      toggle.checked = true;
      for (const id of ["others-clusters", "others-count", "others", "others-names"]) map.setLayoutProperty(id, "visibility", "visible");
    }
  });
  const toggle = root.querySelector<HTMLInputElement>("#pick-others")!;
  toggle.addEventListener("change", () => {
    setOthersOn(storage(), toggle.checked);
    for (const id of ["others-clusters", "others-count", "others", "others-names"]) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", toggle.checked ? "visible" : "none");
    hideCard();
  });
  const card = root.querySelector<HTMLElement>("#pick-card")!;
  const hideCard = (focusMap = false) => {
    card.hidden = true;
    // Closed by keyboard or ✕: focus back on the map, not lost.
    if (focusMap) map.getCanvas().focus();
  };
  const showCard = (p: MapPoint) => {
    const uses = finding
      ? `<button type="button" data-use="${opts.box}">Use this</button>`
      : `<button type="button" data-use="a" data-mode="one">Use as the one place</button><button type="button" class="ghost" data-use="a" data-mode="two">Use as A</button><button type="button" class="ghost" data-use="b" data-mode="two">Use as B</button>`;
    card.innerHTML = `<button type="button" class="ghost icon card-close" aria-label="Close">✕</button>
      <h2 id="card-name">${esc(p.name)}</h2>
      <p class="card-what"><span class="kind kind-${p.kind}">${KIND_TEXT[p.kind]}</span> · ${codeLabel(p)} <b>${esc(p.code)}</b></p>
      ${p.kind === "station" ? "" : `<p class="card-approx">Place approximate (Network Rail's grid reference)</p>`}
      <div class="card-uses">${uses}</div>`;
    card.hidden = false;
    card.querySelector<HTMLButtonElement>("[data-use]")!.focus();
    // Keep the dot in sight above the card (on a small phone the card is over half the map).
    map.easeTo({ center: [p.lon, p.lat], padding: { top: 0, left: 0, right: 0, bottom: card.offsetHeight + 16 }, duration: 300 });
    card.querySelector(".card-close")!.addEventListener("click", () => hideCard(true));
    for (const b of card.querySelectorAll<HTMLButtonElement>("[data-use]"))
      b.addEventListener("click", () => close({ box: b.dataset.use as "a" | "b", code: p.code, name: p.name, mode: b.dataset.mode as "one" | "two" | undefined }));
  };

  /** A dot (or a cluster of them) under a tap, with room for a finger: true when it took the tap. */
  const tappedDot = (e: maplibregl.MapMouseEvent): boolean => {
    if (!map.getLayer("stations")) return false;
    // Room for a finger on Find on map; less on Pick on a map, so a tap on the track beside a dot is still a track tap.
    const r = finding ? 16 : 8;
    const hits = map.queryRenderedFeatures([[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]], { layers: ["stations", "stations-clusters", "others", "others-clusters"] });
    if (!hits.length) return false;
    const cluster = hits.find((f) => f.properties?.cluster);
    const dot = hits
      .filter((f) => !f.properties?.cluster)
      .map((f) => byCode.get(String(f.properties?.code)))
      .filter((p): p is MapPoint => !!p)
      .sort((p, q) => map.project([p.lon, p.lat]).dist(e.point) - map.project([q.lon, q.lat]).dist(e.point))[0];
    if (dot) showCard(dot);
    else if (cluster) {
      const id = Number(cluster.properties?.cluster_id);
      void (map.getSource(String(cluster.source)) as maplibregl.GeoJSONSource).getClusterExpansionZoom(id).then((z) => map.easeTo({ center: e.lngLat, zoom: z + 0.5 }));
    } else return false;
    return true;
  };

  /** Near you, without asking: only when the phone has already said yes. */
  const nearMeIfAllowed = async () => {
    const p = await navigator.permissions?.query({ name: "geolocation" }).catch(() => undefined);
    if (p?.state === "granted") navigator.geolocation.getCurrentPosition((g) => !closed && map.jumpTo({ center: [g.coords.longitude, g.coords.latitude], zoom: 13 }));
  };
  let markers: maplibregl.Marker[] = [];
  let picked: Picked | undefined;
  let asking = 0;
  let inFlight: AbortController | undefined;

  map.on("click", async (e) => {
    showWhere(e.lngLat.lat, e.lngLat.lng);
    hideCard();
    if (tappedDot(e)) return;
    if (finding) {
      if (map.getZoom() < 11) map.flyTo({ center: e.lngLat, zoom: 13 });
      status.textContent = byCode.size ? (toggle.checked ? "Tap a dot: green for stations, orange for junctions, grey for other timing points." : "Tap a station's dot, or switch on junctions and timing points.") : status.textContent;
      return;
    }
    if (map.getZoom() < 13) {
      map.flyTo({ center: e.lngLat, zoom: 15 });
      status.textContent = "Closer in, then tap the track.";
      return;
    }
    const mine = ++asking;
    // Whether OpenStreetMap is being asked (the fallback), to say who didn't answer.
    let askingOsm = false;
    picked = undefined;
    use.disabled = true;
    markers.forEach((m) => m.remove());
    markers = [new maplibregl.Marker({ color: "#64748b" }).setLngLat(e.lngLat).addTo(map)];
    status.textContent = "Looking along the track…";
    try {
      // A new tap cancels the last one's lookup, so taps don't pile up.
      inFlight?.abort();
      inFlight = new AbortController();
      const signal = inFlight.signal;
      const tap = { lat: e.lngLat.lat, lon: e.lngLat.lng };
      // The track from the map's tiles and the dots you can see; OpenStreetMap only where the tiles have no rail, or there are no dots.
      const src = tileSource(map);
      const dots = [...walkable.stations, ...(toggle.checked ? walkable.others : [])];
      let found = src && dots.length ? await findOnTiles(src, tap, dots, signal) : "no track";
      if (mine !== asking) return;
      if (found === "no track") {
        askingOsm = true;
        const slow = window.setTimeout(() => mine === asking && (status.textContent = "Still looking: OpenStreetMap's free servers can be slow, especially late at night…"), 10_000);
        found = await find(tap.lat, tap.lon, signal).finally(() => window.clearTimeout(slow));
        if (mine !== asking) return;
      }
      if (found === "missed") {
        status.textContent = "That's not on the track: zoom in and tap right on the line.";
        return;
      }
      if (!found) {
        status.textContent = toggle.checked
          ? "Couldn't find a railway track with a station or timing point either side here. Tap right on the track, or tap a dot instead."
          : "Couldn't find a railway track with a station either side here. Tap right on the track, switch on junctions and timing points, or tap a dot instead.";
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
      const km = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);
      const between = `Between <b>${esc(found.a.name)}</b> (${km(found.a.along)}) and <b>${esc(found.b.name)}</b> (${km(found.b.along)}).`;
      // The road there names the spot; looked for in the same tiles, so it's quick (and skipped without them).
      const road = src ? await nameOnTiles(src, found.snapped, signal) : undefined;
      if (mine !== asking) return;
      picked = { a: found.a.code, b: found.b.code, f: Math.round(found.f * 100) / 100, aName: found.a.name, bName: found.b.name, road };
      status.innerHTML = road ? `<b>${esc(road)}</b>: ${between.replace("Between", "between")}` : between;
      use.disabled = false;
    } catch (err) {
      if (mine !== asking || (err as Error).name === "AbortError") return;
      status.textContent =
        err instanceof Busy
          ? "OpenStreetMap is busy (it's a free service, shared by everyone): wait half a minute, then tap again."
          : (err as Error).name === "TimeoutError"
            ? "OpenStreetMap is slow to answer just now: try again in a moment."
            : (err as Error).name === "TypeError"
              ? `Couldn't reach ${askingOsm ? "OpenStreetMap" : "the map"}: no signal? Try again in a moment.`
              : `${(err as Error).message}: try again in a moment.`;
    }
  });

  // The keyboard starts on the map (arrows pan it, + and - zoom); Escape closes the card, else the map.
  map.getCanvas().focus();
  root.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    if (!card.hidden) hideCard(true);
    else close(undefined);
  });
  root.querySelector("#pick-me")!.addEventListener("click", () => {
    navigator.geolocation?.getCurrentPosition(
      (p) => map.flyTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 15 }),
      () => (status.textContent = "Couldn't get your location: zoom in by hand."),
    );
  });
  const close = (result: Picked | Filled | undefined) => {
    closed = true;
    inFlight?.abort();
    map.remove();
    document.body.classList.remove("picking");
    done(result);
  };
  use.addEventListener("click", () => picked && close(picked));
  root.querySelector("#pick-cancel")!.addEventListener("click", () => close(undefined));
}
