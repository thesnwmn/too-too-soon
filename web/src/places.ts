// The set-up form's place search: type a station or junction's name, pick it, and its code and
// name go in the form's hidden fields. The list (places.json, made at deploy time from RTT's own)
// is fetched once, the first time a search box is used, and searched here: nothing per keystroke.
import { type Place, placeFor, type Places, searchPlaces } from "@too-too-soon/core";

let list: Promise<Places | undefined> | undefined;

/** The place list, or undefined where there isn't one (the demo on Pages, a deploy that couldn't ask RTT). A download that failed is tried again next time. */
export function loadPlaces(): Promise<Places | undefined> {
  list ??= fetch("places.json")
    .then((r) => (r.ok && (r.headers.get("Content-Type") ?? "").includes("json") ? (r.json() as Promise<Places>) : undefined))
    .catch(() => {
      list = undefined;
      return undefined;
    });
  return list;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** A search box for point `k` ("a" or "b"): the text box, a hidden code and name, and the suggestions under it. `labelHtml` is the page's own markup, never what's typed. */
export function placeField(k: "a" | "b", labelHtml: string, values: { q?: string; code?: string; name?: string }): string {
  const shown = values.q ?? values.name ?? values.code ?? "";
  return `<div class="place">
      <label for="${k}q">${labelHtml}</label>
      <input id="${k}q" name="${k}q" value="${esc(shown)}" placeholder="Search: a station or junction" autocomplete="off" autocapitalize="words" spellcheck="false"
        role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${k}-list">
      <input type="hidden" name="${k}" value="${esc(values.code ?? "")}">
      <input type="hidden" name="${k}n" value="${esc(values.name ?? "")}">
      <small class="chosen" id="${k}-chosen">${values.code ? `${esc(values.code)}` : ""}</small>
      <ul class="suggest" id="${k}-list" role="listbox" aria-label="Places for ${k.toUpperCase()}" hidden></ul>
      <span class="sr-only" id="${k}-count" aria-live="polite"></span>
    </div>`;
}

/**
 * Wires a search box drawn by placeField, as a combobox: suggestions as you type, arrow keys to
 * move through them, Enter or a tap to pick, Escape to close. A list that arrives late (the place
 * list still downloading) only opens if the box still has focus and still says the same.
 */
export function wirePlaceField(form: HTMLFormElement, k: "a" | "b"): void {
  const box = form.elements.namedItem(`${k}q`) as HTMLInputElement;
  const code = form.elements.namedItem(k) as HTMLInputElement;
  const name = form.elements.namedItem(`${k}n`) as HTMLInputElement;
  const chosen = form.querySelector<HTMLElement>(`#${k}-chosen`)!;
  const count = form.querySelector<HTMLElement>(`#${k}-count`)!;
  const ul = form.querySelector<HTMLUListElement>(`#${k}-list`)!;
  let found: Place[] = [];
  let active = -1;
  // Escape (or a pick) before a late list arrives: it stays shut until the next keystroke.
  let dismissed = false;
  const close = () => {
    ul.hidden = true;
    active = -1;
    box.setAttribute("aria-expanded", "false");
    box.removeAttribute("aria-activedescendant");
  };
  const highlight = (i: number) => {
    active = i;
    ul.querySelectorAll("li").forEach((li, j) => li.setAttribute("aria-selected", String(j === i)));
    if (i >= 0) {
      box.setAttribute("aria-activedescendant", `${k}-opt-${i}`);
      ul.children[i]?.scrollIntoView({ block: "nearest" });
    } else box.removeAttribute("aria-activedescendant");
  };
  const choose = (p: Place) => {
    box.value = p.name;
    code.value = p.code;
    name.value = p.name;
    chosen.textContent = p.code;
    dismissed = true;
    close();
  };
  box.addEventListener("focus", () => void loadPlaces());
  box.addEventListener("input", async () => {
    // Typing again un-picks what was picked.
    code.value = "";
    name.value = "";
    chosen.textContent = "";
    const asked = box.value;
    dismissed = false;
    const places = await loadPlaces();
    if (dismissed || document.activeElement !== box || box.value !== asked) return;
    if (!places) {
      box.placeholder = "Type a code, like WOK or CLPHMJN";
      chosen.textContent = "Search isn't available here: type the code (like WOK or CLPHMJN).";
      return;
    }
    found = searchPlaces(places, asked, 6);
    ul.innerHTML = found
      .map((p, i) => `<li role="option" id="${k}-opt-${i}" data-i="${i}" aria-selected="false">${esc(p.name)} <small>${esc(p.code)}${p.station ? "" : " · timing point"}</small></li>`)
      .join("");
    ul.hidden = found.length === 0;
    active = -1;
    box.removeAttribute("aria-activedescendant");
    box.setAttribute("aria-expanded", String(found.length > 0));
    count.textContent = asked.trim() ? (found.length ? `${found.length} place${found.length === 1 ? "" : "s"} found` : "No places found") : "";
    // On a phone the keyboard takes half the screen: bring the list up into what's left.
    if (found.length) ul.scrollIntoView({ block: "nearest" });
  });
  // A tap on a suggestion (pointerdown kept from the box, so blur doesn't close the list first).
  ul.addEventListener("pointerdown", (e) => e.preventDefault());
  ul.addEventListener("click", (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>("li[data-i]");
    if (li) choose(found[Number(li.dataset.i)]);
  });
  box.addEventListener("keydown", (e) => {
    const open = !ul.hidden && found.length > 0;
    if (e.key === "ArrowDown" && open) {
      e.preventDefault();
      highlight((active + 1) % found.length);
    } else if (e.key === "ArrowUp" && open) {
      e.preventDefault();
      highlight(active <= 0 ? found.length - 1 : active - 1);
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      choose(found[Math.max(active, 0)]);
    } else if (e.key === "Escape") {
      if (open) e.preventDefault();
      dismissed = true;
      close();
    }
  });
  box.addEventListener("blur", () => setTimeout(close, 150));
}

/**
 * The code for point `k` when the form is sent: the place picked; or the place whose name or
 * code is typed; or what's typed in capitals if it looks like a code (any case, with no list).
 * Nothing when it's none of these, so the form can say "pick from the list" (typing "Bath" and
 * not picking shouldn't send BATH to RTT as a code).
 */
export function resolvePlace(fd: FormData, k: "a" | "b", places?: Places): { code?: string; name?: string } {
  const picked = String(fd.get(k) ?? "").trim();
  if (picked) return { code: picked, name: String(fd.get(`${k}n`) ?? "").trim() || undefined };
  const typed = String(fd.get(`${k}q`) ?? "").trim();
  if (!typed) return {};
  const p = places && placeFor(places, typed);
  if (p) return { code: p.code, name: p.name };
  // A code typed in capitals is taken as one even when the list doesn't have it (a station's
  // own TIPLOC, say): "BATH" is a code, "Bath" is a word to pick from the list.
  if (/^[A-Z0-9]{3,7}$/.test(typed) || (!places && /^[A-Za-z0-9]{3,7}$/.test(typed))) return { code: typed.toUpperCase() };
  return {};
}
