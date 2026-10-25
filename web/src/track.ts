// The track under a tap on Pick on a map (picker-offline), from the map's own vector tiles: the
// same tiles MapLibre downloads to draw the map (so the ones in view come from the browser's
// cache), decoded here for their rail lines, and our dots as the timing points. More tiles are
// fetched along the line while the walk runs off the edge of those it has. Only the picker loads
// this (code/map-lazy).
import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import { dotNodes, fromTrack, isRunningLine, type LatLon, type Located, locate, type MapPoint, type Tile, TILE_ZOOM, tileKey, tilesAhead, tilesAround, tracksFromLines } from "@too-too-soon/core";

/** Where the tiles are: the map's vector source's URL template (`{z}/{x}/{y}`) and its top zoom. */
export interface TileSource {
  template: string;
  maxzoom: number;
}

/** The first tiles: about 1.5 km each way, enough for most spots between two stations. */
const FIRST_M = 1500;
/** At most this many tiles for one tap, and this many more each time the walk runs off the edge. */
const MAX_TILES = 40;
const MORE = 8;

/** A tile's running lines, in degrees. An empty list for a tile that isn't there (the sea). */
async function railIn(src: TileSource, t: Tile, signal: AbortSignal): Promise<LatLon[][]> {
  const url = src.template.replace("{z}", String(t.z)).replace("{x}", String(t.x)).replace("{y}", String(t.y));
  const r = await fetch(url, { signal });
  if (r.status === 404 || r.status === 204) return [];
  if (!r.ok) throw new Error(`The map's tiles answered ${r.status}`);
  return railLines(await r.arrayBuffer(), t);
}

/** The running lines in one tile (OpenMapTiles' `transportation` layer), in degrees. */
export function railLines(buf: ArrayBuffer, t: Tile): LatLon[][] {
  const layer = new VectorTile(new PbfReader(buf)).layers.transportation;
  if (!layer) return [];
  const n = 2 ** t.z;
  const out: LatLon[][] = [];
  for (let i = 0; i < layer.length; i++) {
    const f = layer.feature(i);
    if (f.type !== 2 || !isRunningLine(f.properties)) continue;
    for (const ring of f.loadGeometry()) {
      out.push(
        ring.map((p) => {
          const wx = (t.x + p.x / layer.extent) / n;
          const wy = (t.y + p.y / layer.extent) / n;
          return { lat: (Math.atan(Math.sinh(Math.PI * (1 - 2 * wy))) * 180) / Math.PI, lon: wx * 360 - 180 };
        }),
      );
    }
  }
  return out;
}

/**
 * The timing points either side of a tap, along the track in the tiles. "No track" when the
 * tiles have no running line within a kilometre of the tap (then the picker asks OpenStreetMap,
 * as the tiles may be missing it); "missed" when there's one, but not within 200 m (the tap
 * missed it, and OpenStreetMap couldn't help); undefined when there's track but no dot both ways
 * within MAX_TILES.
 */
export async function findOnTiles(src: TileSource, tap: LatLon, dots: MapPoint[], signal: AbortSignal): Promise<Located | "no track" | "missed" | undefined> {
  const z = Math.min(src.maxzoom, TILE_ZOOM);
  const have = new Set<string>();
  const lines: LatLon[][] = [];
  let next = tilesAround(tap, FIRST_M, z);
  while (next.length && have.size < MAX_TILES) {
    const batch = next.slice(0, MAX_TILES - have.size);
    for (const t of batch) have.add(tileKey(t));
    for (const l of await Promise.all(batch.map((t) => railIn(src, t, signal)))) lines.push(...l);
    const ways = tracksFromLines(lines);
    const off = fromTrack(ways, tap);
    if (off > 1000) return "no track";
    if (off > 200) return "missed";
    // Only the dots near the tiles there are: locate tries every dot against every bit of track.
    const box = bounds(lines);
    const near = dots.filter((d) => d.lat > box.s && d.lat < box.n && d.lon > box.w && d.lon < box.e);
    // A dot past where a tile cut the line is found further on, from the next tiles; and one found
    // further along than a cut (down a branch, say) waits for them, as a nearer one may be past it.
    const ahead = tilesAhead(ways, tap, have, z);
    const found = locate([...ways, ...dotNodes(near)], tap, ahead.cut);
    next = ahead.tiles.slice(0, MORE);
    if (found && (Math.max(found.a.along, found.b.along) <= ahead.nearestCut || !next.length || have.size >= MAX_TILES)) return found;
  }
  return undefined;
}

/** The box round these lines, with about 300 m to spare (a station's dot can be beside the track). */
function bounds(lines: LatLon[][]): { s: number; n: number; w: number; e: number } {
  const b = { s: 90, n: -90, w: 180, e: -180 };
  for (const l of lines)
    for (const p of l) {
      b.s = Math.min(b.s, p.lat);
      b.n = Math.max(b.n, p.lat);
      b.w = Math.min(b.w, p.lon);
      b.e = Math.max(b.e, p.lon);
    }
  return { s: b.s - 0.003, n: b.n + 0.003, w: b.w - 0.005, e: b.e + 0.005 };
}
