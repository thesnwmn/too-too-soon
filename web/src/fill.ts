// What the set-up form holds after a dot on the map fills a box (find-on-map), as a draft the
// form is drawn from: the box's code, name and search text, and One place or Between two.

/** A dot used to fill a box: `mode` is set when the card said which ("Use as A"), left as it is for Find on map. */
export interface Filled {
  box: "a" | "b";
  code: string;
  name: string;
  mode?: "one" | "two";
}

/**
 * The draft with the box filled, as picking it from the search does, and everything else kept. The
 * mode is the card's if it said, else the form's; failing both, B means Between two.
 */
export function fillDraft(draft: Record<string, string> | undefined, f: Filled): Record<string, string> {
  return { ...draft, [f.box]: f.code, [`${f.box}n`]: f.name, [`${f.box}q`]: f.name, mode: f.mode ?? draft?.mode ?? (f.box === "b" ? "two" : "one") };
}
