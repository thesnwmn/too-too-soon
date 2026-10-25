// The map's switch for junctions and other timing points (timing-toggle): off unless turned on,
// then remembered on this phone. BPLAN places them badly, so they're off by default.

export const OTHERS_KEY = "too-too-soon:timing-points";

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Whether to show them: only if turned on before on this phone. No storage (private browsing): off. */
export function othersOn(s: Store | undefined): boolean {
  try {
    return s?.getItem(OTHERS_KEY) === "on";
  } catch {
    return false;
  }
}

/** Remember the switch: on is kept, off is forgotten (so off stays the default). */
export function setOthersOn(s: Store | undefined, on: boolean): void {
  try {
    if (on) s?.setItem(OTHERS_KEY, "on");
    else s?.removeItem(OTHERS_KEY);
  } catch {
    // Blocked storage: the switch still works until the map closes.
  }
}

/** The dots split for the map: the stations, always shown, and the others, behind the switch. */
export function splitDots<T extends { kind: string }>(dots: T[]): { stations: T[]; others: T[] } {
  return { stations: dots.filter((d) => d.kind === "station"), others: dots.filter((d) => d.kind !== "station") };
}

/**
 * Whether to show the others for this visit though the switch is off: when a box, or the spot
 * being watched, holds one of them, so the map doesn't open on (or leave out) a place with no dot.
 */
export function othersNeeded(kindOf: (code: string) => string | undefined, codes: (string | undefined)[]): boolean {
  return codes.some((c) => {
    const k = c ? kindOf(c) : undefined;
    return k !== undefined && k !== "station";
  });
}
