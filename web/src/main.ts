// The page: a watch view (a big countdown to the next train, then the ones after) and a
// set-up form. It asks only the Worker (api/next); the demo runs on recorded data instead.
import { withDemoClasses, demoLineUps, type ErrorResponse, type NextResponse, parseSpot, type Pass, predictPasses, type Spot, spotParams, upcoming } from "@too-too-soon/core";
import { logo, wordmark } from "./brand.ts";
import { placeField, resolvePlace, wirePlaceField } from "./places.ts";
import { about, clock, countdown, direction, inMinutes, refreshAfter, stopping, sureness, what } from "./format.ts";

const app = document.getElementById("app")!;
const params = new URLSearchParams(location.search);
/** The demo: asked for, or a build with no Worker behind it (GitHub Pages). */
let demo = params.has("demo") || import.meta.env.VITE_DEMO === "1";

const DEMO_SPOT: Spot = { name: "Demo bridge", a: "ASHBYJN", b: "BRAMFD", f: 0.4, aName: "London", bName: "Bramford" };
const SAVED = "too-too-soon:spot";

interface State {
  spot?: Spot;
  data?: NextResponse;
  error?: string;
  /** What the set-up form held when it was turned down, so nothing typed is lost. */
  draft?: Record<string, string>;
  /** Why this is the demo, when it wasn't asked for. */
  demoWhy?: string;
  /** The Worker has no token yet: point at the demo. */
  notSetUp?: boolean;
  /** The map picker has the screen. */
  picking?: boolean;
  loading: boolean;
  editing: boolean;
}
const state: State = { loading: false, editing: false };

// ---- the spot: from the link, or remembered on this phone ----

function readSaved(): Spot | undefined {
  try {
    const raw = localStorage.getItem(SAVED);
    if (!raw) return undefined;
    const r = parseSpot(new URLSearchParams(raw));
    return "spot" in r ? r.spot : undefined;
  } catch {
    return undefined;
  }
}

function useSpot(spot: Spot, save = true): void {
  state.spot = spot;
  if (save && !demo) {
    try {
      localStorage.setItem(SAVED, spotParams(spot).toString());
    } catch {
      // Private browsing: the link still holds the spot.
    }
  }
  const q = spotParams(spot);
  if (demo) q.set("demo", "");
  history.replaceState(null, "", `?${q.toString().replace(/demo=(&|$)/, "demo$1")}`);
}

// ---- the trains ----

let demoAnchor = Date.now();

function demoData(now: number): NextResponse {
  let passes = upcoming(predictPasses(demoLineUps(demoAnchor).a, demoLineUps(demoAnchor).b, state.spot?.f ?? DEMO_SPOT.f), now);
  if (passes.length < 4) {
    demoAnchor = now;
    passes = upcoming(predictPasses(demoLineUps(now).a, demoLineUps(now).b, state.spot?.f ?? DEMO_SPOT.f), now);
  }
  return { generatedAt: now, passes: withDemoClasses(passes), aName: "Ashby Junction", bName: "Bramford" };
}

let timer: number | undefined;
/** Counts requests, so an answer for a spot that's since been changed is ignored. */
let asked = 0;

async function refresh(): Promise<void> {
  window.clearTimeout(timer);
  const spot = state.spot;
  if (!spot || state.editing) return;
  const mine = ++asked;
  let wait: number | undefined;
  state.loading = true;
  render();
  if (demo) {
    state.data = demoData(Date.now());
    state.error = undefined;
  } else {
    try {
      const r = await fetch(`api/next?${spotParams(spot)}`, { headers: { Accept: "application/json" } });
      if (mine !== asked) return;
      const type = r.headers.get("Content-Type") ?? "";
      const retry = Number(r.headers.get("Retry-After"));
      if (r.status === 429 && retry > 0) wait = retry * 1000;
      if (!type.includes("json") && r.status !== 404) {
        state.error = "Couldn't get the trains just now: trying again shortly.";
      } else if (!type.includes("json")) {
        // No Worker behind this page (a static host): show the demo's own made-up spot, and say why.
        demo = true;
        state.demoWhy = "There's no live data on this site, so here's the demo: made-up trains on a made-up line.";
        useSpot(DEMO_SPOT, false);
        state.data = demoData(Date.now());
      } else {
        const body = (await r.json()) as NextResponse | ErrorResponse;
        state.notSetUp = r.status === 503;
        if ("error" in body) state.error = body.error;
        else {
          state.data = body;
          state.error = undefined;
        }
      }
    } catch {
      if (mine !== asked) return;
      state.error = "Couldn't reach the server: no signal?";
    }
  }
  state.loading = false;
  render();
  if (document.visibilityState === "visible") timer = window.setTimeout(refresh, Math.max(wait ?? 0, refreshAfter(state.data?.passes ?? [], Date.now())));
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return window.clearTimeout(timer);
  // Back on screen: ask again if the list is more than a minute old.
  if (!state.data || Date.now() - state.data.generatedAt > 60_000) void refresh();
  else timer = window.setTimeout(refresh, refreshAfter(state.data.passes, Date.now()));
});

// ---- drawing ----

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** RTT's names for the timing points, for a spot set up without its own. */
const names = () => ({ a: state.data?.aName, b: state.data?.bName });

/** The trains opened for more detail: kept across redraws, which happen every half minute. */
const openRows = new Set<string>();

/** One train in the list: compact, and a tap opens who runs it, what it is, where from. */
function trainLine(p: Pass, spot: Spot, now: number): string {
  const d = direction(p, spot, names());
  const more = [about(p), [`towards ${d.towards}`, sureness(p), p.headcode].filter(Boolean).join(" · ")].filter(Boolean);
  return `<li class="train ${p.passenger ? "" : "freight"}"><details data-id="${esc(p.id)}"${openRows.has(p.id) ? " open" : ""}>
    <summary>
      <span class="arrow" role="img" aria-label="towards ${esc(d.towards)}">${d.arrow}</span>
      <span class="when"><b>${clock(p.time)}</b> <small>${inMinutes(p.time, now)}</small></span>
      <span class="what">${esc(what(p))}<small>${esc(stopping(p, spot, names()))}</small></span>
      <span class="chevron" aria-hidden="true"></span>
    </summary>
    <div class="more">${more.map((m) => `<small>${esc(m)}</small>`).join("")}</div>
  </details></li>`;
}

function watchView(spot: Spot, now: number): string {
  const data = state.data;
  const passes = data ? upcoming(data.passes, now, 15_000) : [];
  const [next, ...rest] = passes;
  let hero: string;
  if (!data && state.notSetUp) hero = `<p class="hint">The live train data isn't set up yet. <a href="?demo">Try the demo</a> to see what it'll look like.</p>`;
  else if (!data) hero = `<p class="hint">${state.error ? esc(state.error) : "Looking for trains…"}</p>`;
  else if (!next) hero = `<p class="hint">No trains due in the next hour or so.</p>`;
  else {
    const d = direction(next, spot, { a: data.aName, b: data.bName });
    hero = `<section class="next ${next.passenger ? "" : "freight"}" aria-label="Next train">
      <p class="label">Next too too</p>
      <p class="count" data-time="${next.time}">${countdown(next.time, now)}</p>
      <p class="dir"><span aria-hidden="true">${d.arrow}</span> towards ${esc(d.towards)}</p>
      <p class="detail">${esc(what(next))}</p>
      ${about(next) ? `<p class="detail small">${esc(about(next))}</p>` : ""}
      <p class="detail small">${clock(next.time)} · ${esc(stopping(next, spot, names()))} · ${esc(sureness(next))}${next.headcode ? ` · ${esc(next.headcode)}` : ""}</p>
    </section>`;
  }
  const age = data ? Math.round((now - data.generatedAt) / 60_000) : 0;
  const notes = [
    demo && `${state.demoWhy ? esc(state.demoWhy) : "Demo: made-up trains on a made-up line."} <a href="?">Set up your spot</a>.`,
    state.error && data && esc(state.error),
    data?.stale && `Couldn't ask Realtime Trains just now: this list is from ${age} min ago.`,
    data?.limited && "Realtime Trains says its live data is limited: times may be timetable only.",
    data?.stoppingOnly && `Only trains that stop at ${esc(spot.aName ?? data.aName ?? spot.a)} and ${esc(spot.bName ?? data.bName ?? spot.b)} are listed: fast trains and freight may go by too.`,
  ].filter(Boolean);
  return `<header>
      <div class="brand">${logo}<div>${wordmark("small")}<h1>${esc(spot.name)}</h1></div></div>
      <button type="button" id="edit" class="ghost" aria-label="Change spot">Change<span class="wide-only"> spot</span></button>
    </header>
    ${hero}
    ${rest.length ? `<ol class="list">${rest.slice(0, 8).map((p) => trainLine(p, spot, now)).join("")}</ol>` : ""}
    ${notes.map((n) => `<p class="note">${n}</p>`).join("")}
    <footer>
      <button type="button" id="refresh" class="ghost" ${state.loading ? "disabled" : ""}>${state.loading ? "Asking…" : "Refresh"}</button>
      <p>Times are estimates between ${esc(spot.aName ?? spot.a)} and ${esc(spot.bName ?? spot.b)}: allow a couple of minutes either way. Data from <a href="https://www.realtimetrains.co.uk/">Realtime Trains</a> and Network Rail.</p>
    </footer>`;
}

function setupView(): string {
  const s = state.spot;
  const d = state.draft;
  const v = (x: string | number | undefined) => (x === undefined ? "" : esc(String(x)));
  const val = (k: string, x: string | number | undefined) => v(d ? d[k] : x);
  return `<header><h1 class="brand">${logo}${wordmark()}</h1>${s ? `<button type="button" id="cancel" class="ghost">Cancel</button>` : ""}</header>
    <p class="intro">How long till the next too too? Set up the spot you watch trains from: tap it on a map, or search for the stations or junctions either side.</p>
    <button type="button" id="pick" class="wide">Pick on a map</button>
    ${state.error ? `<p class="note">${esc(state.error)}</p>` : ""}
    <form id="setup">
      <label>Name <input name="name" value="${val("name", s?.name)}" placeholder="Our bridge" maxlength="60"></label>
      ${placeField("a", "Timing point A", { q: d?.aq, code: d ? d.a : s?.a, name: d ? d.an : s?.aName })}
      ${placeField("b", "Timing point B", { q: d?.bq, code: d ? d.b : s?.b, name: d ? d.bn : s?.bName })}
      <button type="button" id="swap" class="ghost">Swap A and B</button>
      <label>How far from A to B is your spot? <output id="fout">${Math.round(Number(d?.f ?? s?.f ?? 0.5) * 100)}%</output>
        <input type="range" name="f" min="0" max="1" step="0.01" value="${val("f", s?.f ?? 0.5)}">
      </label>
      <button type="submit">Show the trains</button>
    </form>
    <p class="intro"><a href="?demo">Try the demo</a> to see what it looks like.</p>`;
}

function render(): void {
  if (state.picking) return;
  const now = Date.now();
  // The redraw replaces the page: keep a keyboard or screen reader on the train it was on.
  const focused = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>("details[data-id]")?.dataset.id;
  app.innerHTML = state.spot && !state.editing ? watchView(state.spot, now) : setupView();
  if (focused) app.querySelector<HTMLElement>(`details[data-id="${CSS.escape(focused)}"] summary`)?.focus();
  // Forget opened trains that have gone by.
  const listed = new Set(state.data?.passes.map((p) => p.id));
  for (const id of openRows) if (!listed.has(id)) openRows.delete(id);
  for (const row of app.querySelectorAll<HTMLDetailsElement>("details[data-id]"))
    row.addEventListener("toggle", () => (row.open ? openRows.add(row.dataset.id!) : openRows.delete(row.dataset.id!)));
  document.getElementById("edit")?.addEventListener("click", () => {
    if (demo) {
      // Leaving the demo: the link shouldn't bring it back on a reload.
      demo = false;
      state.demoWhy = undefined;
      state.spot = readSaved();
      history.replaceState(null, "", location.pathname);
    }
    state.editing = true;
    state.error = undefined;
    render();
  });
  document.getElementById("refresh")?.addEventListener("click", () => void refresh());
  document.getElementById("pick")?.addEventListener("click", () => void pick());
  document.getElementById("swap")?.addEventListener("click", () => {
    const form = document.getElementById("setup") as HTMLFormElement;
    const field = (n: string) => form.elements.namedItem(n) as HTMLInputElement;
    for (const [x, y] of [["a", "b"], ["an", "bn"], ["aq", "bq"]]) [field(x).value, field(y).value] = [field(y).value, field(x).value];
    for (const [x, y] of [["a-chosen", "b-chosen"]]) {
      const [ex, ey] = [document.getElementById(x)!, document.getElementById(y)!];
      [ex.textContent, ey.textContent] = [ey.textContent, ex.textContent];
    }
    const f = field("f");
    f.value = String(Math.round((1 - Number(f.value)) * 100) / 100);
    document.getElementById("fout")!.textContent = `${Math.round(Number(f.value) * 100)}%`;
  });
  document.getElementById("cancel")?.addEventListener("click", () => {
    state.editing = false;
    state.draft = undefined;
    state.error = undefined;
    render();
    void refresh();
  });
  const form = document.getElementById("setup") as HTMLFormElement | null;
  if (form) {
    const f = form.elements.namedItem("f") as HTMLInputElement;
    f.addEventListener("input", () => (document.getElementById("fout")!.textContent = `${Math.round(Number(f.value) * 100)}%`));
    wirePlaceField(form, "a");
    wirePlaceField(form, "b");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const q = new URLSearchParams();
      for (const k of ["name", "f"]) if (String(fd.get(k) ?? "").trim()) q.set(k, String(fd.get(k)));
      const missing: string[] = [];
      for (const k of ["a", "b"] as const) {
        const p = resolvePlace(fd, k);
        if (p.code) q.set(k, p.code);
        else missing.push(k.toUpperCase());
        if (p.name) q.set(`${k}n`, p.name);
      }
      const r = missing.length ? { error: `Pick ${missing.join(" and ")} from the list as you type, or type ${missing.length > 1 ? "their codes" : "its code"}.` } : parseSpot(q);
      if ("error" in r) {
        state.error = r.error;
        state.draft = Object.fromEntries([...fd].map(([k, x]) => [k, String(x)]));
        return render();
      }
      state.draft = undefined;
      state.editing = false;
      state.data = undefined;
      state.error = undefined;
      useSpot(r.spot);
      void refresh();
    });
  }
}

// The countdown ticks every second without asking anyone, and the list's "in N min" every 30.
let ticks = 0;
window.setInterval(() => {
  if (++ticks % 30 === 0 && state.spot && !state.editing) return render();
  const el = app.querySelector<HTMLElement>(".count");
  if (!el) return;
  const t = Number(el.dataset.time);
  const text = countdown(t, Date.now());
  // Once it's gone, redraw: the next train moves up.
  if (text === "gone") render();
  else el.textContent = text;
}, 1000);

// ---- the map picker, loaded only when it's wanted ----

async function pick(): Promise<void> {
  // Keep what's typed, so Cancel (or a pick) comes back to it.
  const form = document.getElementById("setup") as HTMLFormElement | null;
  if (form) state.draft = Object.fromEntries([...new FormData(form)].map(([k, x]) => [k, String(x)]));
  const name = (state.draft?.name ?? "").trim();
  state.picking = true;
  app.innerHTML = `<p class="hint">Loading the map…</p>`;
  try {
    const { openPicker } = await import("./picker.ts");
    openPicker(app, (picked) => {
      state.picking = false;
      if (picked) {
        state.error = undefined;
        state.draft = { ...state.draft, name: name || `Between ${picked.aName} and ${picked.bName}`, a: picked.a, b: picked.b, f: String(picked.f), an: picked.aName, bn: picked.bName, aq: picked.aName, bq: picked.bName };
      }
      render();
    });
  } catch {
    state.picking = false;
    state.error = "Couldn't load the map: no signal? You can type the codes instead.";
    render();
  }
}

// ---- start ----

const fromLink = parseSpot(params);
if ("spot" in fromLink) useSpot(fromLink.spot);
else if (demo) useSpot(DEMO_SPOT, false);
else {
  const saved = readSaved();
  if (saved) useSpot(saved, false);
}
render();
void refresh();
