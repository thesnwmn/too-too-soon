// The set-up form's place search: type a station or junction's name, pick it, and its code and
// name go in the form's hidden fields. The list (places.json, made at deploy time from RTT's own)
// is fetched once, the first time a search box is used, and searched here: nothing per keystroke.
import { type Place, type Places, searchPlaces } from "@too-too-soon/core";

let list: Promise<Places | undefined> | undefined;

/** The place list, or undefined where there isn't one (the demo on Pages, a deploy that couldn't ask RTT). */
export function loadPlaces(): Promise<Places | undefined> {
  list ??= fetch("places.json")
    .then((r) => (r.ok && (r.headers.get("Content-Type") ?? "").includes("json") ? (r.json() as Promise<Places>) : undefined))
    .catch(() => undefined);
  return list;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** A search box for point `k` ("a" or "b"): the text box, a hidden code and name, and the suggestions under it. */
export function placeField(k: "a" | "b", label: string, values: { q?: string; code?: string; name?: string }): string {
  const shown = values.q ?? values.name ?? values.code ?? "";
  return `<div class="place">
      <label for="${k}q">${esc(label)}</label>
      <input id="${k}q" name="${k}q" value="${esc(shown)}" placeholder="Search: a station or junction" autocomplete="off" autocapitalize="words" spellcheck="false"
        role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${k}-list">
      <input type="hidden" name="${k}" value="${esc(values.code ?? "")}">
      <input type="hidden" name="${k}n" value="${esc(values.name ?? "")}">
      <small class="chosen" id="${k}-chosen">${values.code ? `${esc(values.code)}` : ""}</small>
      <ul class="suggest" id="${k}-list" role="listbox" hidden></ul>
    </div>`;
}

/** Wires a search box drawn by placeField. */
export function wirePlaceField(form: HTMLFormElement, k: "a" | "b"): void {
  const box = form.elements.namedItem(`${k}q`) as HTMLInputElement;
  const code = form.elements.namedItem(k) as HTMLInputElement;
  const name = form.elements.namedItem(`${k}n`) as HTMLInputElement;
  const chosen = form.querySelector<HTMLElement>(`#${k}-chosen`)!;
  const ul = form.querySelector<HTMLUListElement>(`#${k}-list`)!;
  let found: Place[] = [];
  const close = () => {
    ul.hidden = true;
    box.setAttribute("aria-expanded", "false");
  };
  const choose = (p: Place) => {
    box.value = p.name;
    code.value = p.code;
    name.value = p.name;
    chosen.textContent = p.code;
    close();
  };
  box.addEventListener("focus", () => void loadPlaces());
  box.addEventListener("input", async () => {
    // Typing again un-picks what was picked.
    code.value = "";
    name.value = "";
    chosen.textContent = "";
    const places = await loadPlaces();
    if (!places) {
      chosen.textContent = "Search isn't available here: type the code (like WOK or CLPHMJN).";
      return;
    }
    found = searchPlaces(places, box.value, 6);
    ul.innerHTML = found
      .map((p, i) => `<li role="option" id="${k}-opt-${i}"><button type="button" data-i="${i}">${esc(p.name)} <small>${esc(p.code)}${p.station ? "" : " · timing point"}</small></button></li>`)
      .join("");
    ul.hidden = found.length === 0;
    box.setAttribute("aria-expanded", String(found.length > 0));
  });
  // A tap on a suggestion (pointerdown, so the box doesn't lose it to blur first).
  ul.addEventListener("pointerdown", (e) => e.preventDefault());
  ul.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-i]");
    if (b) choose(found[Number(b.dataset.i)]);
  });
  box.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !ul.hidden && found[0]) {
      e.preventDefault();
      choose(found[0]);
    } else if (e.key === "Escape") close();
  });
  box.addEventListener("blur", () => setTimeout(close, 150));
}

/**
 * The code for point `k` when the form is sent: the place picked, or what's typed if it's a
 * code. Undefined when there's text that's neither, so the form can say "pick from the list".
 */
export function resolvePlace(fd: FormData, k: "a" | "b"): { code?: string; name?: string } {
  const picked = String(fd.get(k) ?? "").trim();
  if (picked) return { code: picked, name: String(fd.get(`${k}n`) ?? "").trim() || undefined };
  const typed = String(fd.get(`${k}q`) ?? "").trim();
  return /^[A-Za-z0-9]{3,7}$/.test(typed) ? { code: typed.toUpperCase() } : {};
}
