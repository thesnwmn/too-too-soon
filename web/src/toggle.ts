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
