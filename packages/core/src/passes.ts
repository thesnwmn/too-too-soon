// Which trains pass a spot between timing points A and B, and when. The method is in
// docs/how-it-works.md: join the trains listed at A and at B, and interpolate a fraction
// `f` of the way from A to B. Times are epoch milliseconds inside.
import type { RttLocationResponse, RttService, RttTimes } from "./rtt.ts";

/** How sure a time is: a train has really passed the first point, has live forecasts, or only a timetable. */
export type Basis = "actual" | "forecast" | "timetable";

/** "ab" heads from A towards B; "ba" from B towards A. */
export type Direction = "ab" | "ba";

export interface Pass {
  /** RTT's unique identity: the service and its date. */
  id: string;
  /** The predicted time at the spot. */
  time: number;
  basis: Basis;
  direction: Direction;
  /** The headcode, like 1A23. */
  headcode?: string;
  /** False for freight and empty stock. */
  passenger: boolean;
  operator?: string;
  origin?: string;
  destination?: string;
  /** Passenger vehicles, when RTT knows. */
  coaches?: number;
  /** Minutes late leaving the first point, when there's live data. */
  late?: number;
  /** Whether it stops at the point it leaves before the spot, and the one after. */
  stopsBefore: boolean;
  stopsAfter: boolean;
  /** The times used at A and B. */
  timeA: number;
  timeB: number;
}

/** A timing point's code, as RTT takes it: a TIPLOC (up to 7) or a CRS code (3). */
export const isLocationCode = (code: string): boolean => /^[A-Z0-9]{3,7}$/.test(code);

interface Best {
  time: number;
  basis: Basis;
}

/** The best known time for one activity: actual, then forecast, then estimate, then the timetable. */
export function best(t: RttTimes | undefined): Best | undefined {
  if (!t || t.isCancelled) return undefined;
  const at = (s: string | undefined) => (s ? Date.parse(s) : NaN);
  const candidates: [string | undefined, Basis][] = [
    [t.realtimeActual, "actual"],
    [t.realtimeForecast, "forecast"],
    [t.realtimeEstimate, "forecast"],
    [t.scheduleInternal, "timetable"],
    [t.scheduleAdvertised, "timetable"],
  ];
  for (const [s, basis] of candidates) {
    const time = at(s);
    if (!Number.isNaN(time)) return { time, basis };
  }
  return undefined;
}

/** The timetabled time of a service at a location, whichever activity it has: for ordering only. */
function scheduled(s: RttService): number | undefined {
  const td = s.temporalData;
  for (const t of [td?.pass, td?.arrival, td?.departure]) {
    const v = t?.scheduleInternal ?? t?.scheduleAdvertised;
    if (v) return Date.parse(v);
  }
  return undefined;
}

const gone = (s: RttService) => s.temporalData?.displayAs === "CANCELLED" || s.temporalData?.displayAs === "DIVERTED";

/** It stops here: a call, or it starts or ends here. A null display is a pass. */
const stops = (s: RttService) => ["CALL", "STARTS", "TERMINATES"].includes(s.temporalData?.displayAs ?? "PASS");

/** Leaving a point: its departure, or its pass. */
const leaving = (s: RttService) => best(s.temporalData?.departure) ?? best(s.temporalData?.pass);
/** Reaching a point: its arrival, or its pass. */
const reaching = (s: RttService) => best(s.temporalData?.arrival) ?? best(s.temporalData?.pass);

/** The passes of every train listed at both A and B, `f` of the way from A to B, soonest first. */
export function predictPasses(atA: RttLocationResponse, atB: RttLocationResponse, f: number): Pass[] {
  const byId = new Map<string, RttService>();
  for (const s of atB.services ?? []) {
    const id = s.scheduleMetadata?.uniqueIdentity;
    if (id && !gone(s)) byId.set(id, s);
  }
  const passes: Pass[] = [];
  for (const a of atA.services ?? []) {
    const id = a.scheduleMetadata?.uniqueIdentity;
    const b = id ? byId.get(id) : undefined;
    if (!id || !b || gone(a)) continue;
    const sa = scheduled(a);
    const sb = scheduled(b);
    if (sa === undefined || sb === undefined || sa === sb) continue;
    const direction: Direction = sa < sb ? "ab" : "ba";
    const [first, second, fraction] = direction === "ab" ? [a, b, f] : [b, a, 1 - f];
    const from = leaving(first);
    const to = reaching(second);
    if (!from || !to) continue;
    const time = from.time + fraction * (to.time - from.time);
    const basis: Basis = from.basis === "actual" ? "actual" : from.basis === "forecast" || to.basis !== "timetable" ? "forecast" : "timetable";
    const meta = a.scheduleMetadata ?? {};
    const late = first.temporalData?.departure?.realtimeInternalLateness ?? first.temporalData?.pass?.realtimeInternalLateness;
    const coaches = a.locationMetadata?.numberOfVehicles ?? b.locationMetadata?.numberOfVehicles;
    passes.push({
      id,
      time,
      basis,
      direction,
      headcode: meta.trainReportingIdentity,
      passenger: meta.inPassengerService !== false,
      operator: meta.operator?.name,
      origin: a.origin?.[0]?.location?.description,
      destination: a.destination?.[a.destination.length - 1]?.location?.description,
      coaches: coaches && coaches > 0 ? coaches : undefined,
      late: basis === "timetable" || late == null ? undefined : late,
      stopsBefore: stops(first),
      stopsAfter: stops(second),
      timeA: direction === "ab" ? from.time : to.time,
      timeB: direction === "ab" ? to.time : from.time,
    });
  }
  return passes.sort((x, y) => x.time - y.time);
}

/** Passes from `graceMs` ago onwards: a train a minute late past the bridge may still be in sight. */
export const upcoming = (passes: Pass[], now: number, graceMs = 60_000): Pass[] => passes.filter((p) => p.time >= now - graceMs);

/** Whether RTT says its live data is limited, so times may be timetable only. */
export function liveDataLimited(...responses: RttLocationResponse[]): boolean {
  return responses.some((r) => {
    const s = r.systemStatus;
    return (s?.realtimeNetworkRail !== undefined && s.realtimeNetworkRail !== "OK") || (s?.rttCore !== undefined && s.rttCore !== "OK");
  });
}
