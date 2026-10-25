// What the set-up form holds after a dot on the map fills a box (find-on-map), or a tap on the
// track picks the spot, as a draft the form is drawn from: the box's code, name and search text,
// and One place or Between two. And the name the spot is given until you type your own
// (auto-name): the place's, the road's at a tap on the track, else "Between A and B".

/** A dot used to fill a box: `mode` is set when the card said which ("Use as A"), left as it is for Find on map. */
export interface Filled {
  box: "a" | "b";
  code: string;
  name: string;
  mode?: "one" | "two";
}

/** A spot picked by tapping the track (the picker's Picked). */
export interface Tapped {
  a: string;
  b: string;
  f: number;
  aName: string;
  bName: string;
  road?: string;
}

type Draft = Record<string, string>;

/** Which spot a road name was found for (`rfor`): A, B and how far along, either way round, as Swap turns it. */
const roadKey = (a: string, b: string, f: string | number) => {
  const x = Math.round(Number(f) * 100);
  return a < b ? `${a}|${b}|${x}` : `${b}|${a}|${100 - x}`;
};

/** How far (in %) the slider can be nudged off the tap with the road's name kept: fine-tuning, not moving. */
const NUDGE = 5;

/** Whether the form's A, B and slider are still the spot the road was found for, give or take a nudge. */
function atRoad(d: Draft): boolean {
  const [ra, rb, rx] = (d.rfor ?? "").split("|");
  const [a, b, x] = roadKey(d.a ?? "", d.b ?? "", d.f ?? "").split("|");
  return ra === a && rb === b && Math.abs(Number(rx) - Number(x)) <= NUDGE;
}

/**
 * The name a spot is given until you type your own: one place, its name; between two, the road
 * at the tap while A, B and the slider are where the tap put them (give or take a nudge), else "Between A and B". Empty
 * while the places aren't picked yet.
 */
export function autoName(d: Draft | undefined): string {
  if (!d) return "";
  if (d.mode !== "two") return d.an ?? "";
  if (d.rn && atRoad(d)) return d.rn;
  return d.an && d.bn ? `Between ${d.an} and ${d.bn}` : "";
}

/** Whether the Name box is the made-up one: as the form last said, else when it's empty or matches. */
export function autoOn(d: Draft | undefined): boolean {
  if (d?.auto) return d.auto === "1";
  const name = (d?.name ?? "").trim();
  return !name || name === autoName(d);
}

/** The draft with its name made up again, if it's the made-up one. */
function named(before: Draft | undefined, after: Draft): Draft {
  if (!autoOn(before)) return after;
  return { ...after, auto: "1", name: autoName(after) };
}

/**
 * The draft with the box filled, as picking it from the search does, and everything else kept. The
 * mode is the card's if it said, else the form's; failing both, B means Between two.
 */
export function fillDraft(draft: Draft | undefined, f: Filled): Draft {
  return named(draft, { ...draft, [f.box]: f.code, [`${f.box}n`]: f.name, [`${f.box}q`]: f.name, mode: f.mode ?? draft?.mode ?? (f.box === "b" ? "two" : "one") });
}

/** The draft with the spot a tap on the track found: both boxes, the slider, and the road there to name it after. */
export function tapDraft(draft: Draft | undefined, t: Tapped): Draft {
  const f = String(t.f);
  return named(draft, { ...draft, a: t.a, b: t.b, f, an: t.aName, bn: t.bName, aq: t.aName, bq: t.bName, mode: "two", rn: t.road ?? "", rfor: t.road ? roadKey(t.a, t.b, f) : "" });
}
