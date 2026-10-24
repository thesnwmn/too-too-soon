// Which trains pass a spot between timing points A and B, and when. The method is in
// docs/how-it-works.md: join the trains listed at A and at B, and interpolate a fraction
// `f` of the way from A to B. Times are epoch milliseconds inside.
import type { RttLocationResponse, RttService, RttServiceResponse, RttTimes } from "./rtt.ts";

/** How sure a time is: a train has really passed the first point, has live forecasts, or only a timetable. */
export type Basis = "actual" | "forecast" | "timetable";

/** "ab" heads from A towards B; "ba" from B towards A; "at" is at a one-point spot, heading for its destination. */
export type Direction = "ab" | "ba" | "at";

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
  /** Which of RTT's allocations it runs with past here (see trainClassOf). */
  allocationIndex?: number;
  /** The class of train, like "444", when RTT's allocations say (filled in by the Worker). */
  trainClass?: string;
  /** Minutes late leaving the first point, when there's live data. */
  late?: number;
  /** At a one-point spot: it starts or ends its journey here. */
  startsHere?: boolean;
  endsHere?: boolean;
  /** Whether it stops at the point it leaves before the spot, and the one after. */
  stopsBefore: boolean;
  stopsAfter: boolean;
  /** The times used at A and B. */
  timeA: number;
  timeB: number;
}

/** A timing point's code, as RTT takes it: a TIPLOC (up to 7) or a CRS code (3). */
export const isLocationCode = (code: string): boolean => /^[A-Z0-9]{3,7}$/.test(code);

const london = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** How far UK time is ahead of UTC at an instant: 0 in winter, an hour in summer. */
function londonOffset(utc: number): number {
  const p = Object.fromEntries(london.formatToParts(new Date(utc)).map((x) => [x.type, x.value]));
  const wall = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return wall - Math.floor(utc / 1000) * 1000;
}

/**
 * An RTT time as epoch ms. The spec allows an offset, but the live API sends UK wall-clock
 * times without one ("2026-10-24T00:12:00"), which JavaScript would read as the machine's own
 * zone: so a time without an offset is taken as UK time.
 */
export function rttTime(s: string): number {
  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) return Date.parse(s);
  const asUtc = Date.parse(`${s}Z`);
  if (Number.isNaN(asUtc)) return NaN;
  const guess = asUtc - londonOffset(asUtc);
  return asUtc - londonOffset(guess);
}

interface Best {
  time: number;
  basis: Basis;
  /** The timetabled time of the same activity, when there is one. */
  scheduled?: number;
}

/** The best known time for one activity: actual, then forecast, then estimate, then the timetable. */
export function best(t: RttTimes | undefined): Best | undefined {
  if (!t || t.isCancelled) return undefined;
  const at = (s: string | undefined) => (s ? rttTime(s) : NaN);
  const candidates: [string | undefined, Basis][] = [
    [t.realtimeActual, "actual"],
    [t.realtimeForecast, "forecast"],
    [t.realtimeEstimate, "forecast"],
    [t.scheduleInternal, "timetable"],
    [t.scheduleAdvertised, "timetable"],
  ];
  const sched = at(t.scheduleInternal ?? t.scheduleAdvertised);
  const scheduled = Number.isNaN(sched) ? undefined : sched;
  for (const [s, basis] of candidates) {
    const time = at(s);
    if (!Number.isNaN(time)) return { time, basis, scheduled };
  }
  return undefined;
}

/** The timetabled time of a service at a location, whichever activity it has: for ordering only. */
function scheduled(s: RttService): number | undefined {
  const td = s.temporalData;
  for (const t of [td?.pass, td?.arrival, td?.departure]) {
    const v = t?.scheduleInternal ?? t?.scheduleAdvertised;
    if (v) return rttTime(v);
  }
  return undefined;
}

/**
 * Not coming past: cancelled or diverted here, or not a train (a replacement bus listed at a
 * station). A cancelled call can mean "won't stop" rather than "won't run" (RTT doesn't say
 * which), so a few trains that do pass are missed: the safer error at a bridge.
 */
const gone = (s: RttService) =>
  s.temporalData?.displayAs === "CANCELLED" || s.temporalData?.displayAs === "DIVERTED" || (s.scheduleMetadata?.modeType !== undefined && s.scheduleMetadata.modeType !== "TRAIN");

/** It stops here: a call, or it starts or ends here. A null display is a pass. */
const stops = (s: RttService) => ["CALL", "STARTS", "TERMINATES"].includes(s.temporalData?.displayAs ?? "PASS");

/** Leaving a point: its departure, or its pass. */
const leaving = (s: RttService) => best(s.temporalData?.departure) ?? best(s.temporalData?.pass);
/** Reaching a point: its arrival, or its pass. */
const reaching = (s: RttService) => best(s.temporalData?.arrival) ?? best(s.temporalData?.pass);

/** The passes of every train listed at both A and B, `f` of the way from A to B, soonest first. */
export function predictPasses(atA: RttLocationResponse, atB: RttLocationResponse, f: number): Pass[] {
  // One entry per service at B: one that's listed twice there (it reverses) keeps its last.
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
    // Live at the first point but only a timetable at the second: carry the lateness over, so a
    // late train isn't sent towards an on-time arrival (and never reaches B before it left A).
    const lateMs = from.basis !== "timetable" && from.scheduled !== undefined ? from.time - from.scheduled : undefined;
    let toTime = to.time;
    if (to.basis === "timetable" && lateMs !== undefined && to.scheduled !== undefined) toTime = to.scheduled + lateMs;
    toTime = Math.max(toTime, from.time);
    const time = from.time + fraction * (toTime - from.time);
    const basis: Basis = from.basis === "actual" ? "actual" : from.basis === "forecast" || to.basis !== "timetable" ? "forecast" : "timetable";
    const meta = a.scheduleMetadata ?? {};
    // RTT's own lateness field is empty until a train has really passed, so work it out.
    const late = lateMs === undefined ? undefined : Math.round(lateMs / 60_000);
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
      allocationIndex: first.locationMetadata?.allocationIndex,
      late,
      stopsBefore: stops(first),
      stopsAfter: stops(second),
      timeA: direction === "ab" ? from.time : toTime,
      timeB: direction === "ab" ? toTime : from.time,
    });
  }
  return passes.sort((x, y) => x.time - y.time);
}

/**
 * The trains at a single timing point (a one-point spot), soonest first: each when it's there,
 * as it leaves (or passes, or arrives where it ends), heading for its destination, or marked as
 * ending its journey here.
 */
export function predictAt(at: RttLocationResponse): Pass[] {
  // One entry per service: one listed twice here (it reverses) keeps its last, the way out.
  const byId = new Map<string, RttService>();
  for (const s of at.services ?? []) {
    const id = s.scheduleMetadata?.uniqueIdentity;
    if (id && !gone(s)) byId.set(id, s);
  }
  const passes: Pass[] = [];
  for (const [id, s] of byId) {
    const when = leaving(s) ?? reaching(s);
    if (!when) continue;
    const meta = s.scheduleMetadata ?? {};
    const lateMs = when.basis !== "timetable" && when.scheduled !== undefined ? when.time - when.scheduled : undefined;
    const coaches = s.locationMetadata?.numberOfVehicles;
    const here = stops(s);
    const display = s.temporalData?.displayAs;
    passes.push({
      id,
      time: when.time,
      basis: when.basis,
      direction: "at",
      headcode: meta.trainReportingIdentity,
      passenger: meta.inPassengerService !== false,
      operator: meta.operator?.name,
      origin: s.origin?.[0]?.location?.description,
      destination: s.destination?.[s.destination.length - 1]?.location?.description,
      coaches: coaches && coaches > 0 ? coaches : undefined,
      allocationIndex: s.locationMetadata?.allocationIndex,
      late: lateMs === undefined ? undefined : Math.round(lateMs / 60_000),
      ...(display === "STARTS" && { startsHere: true }),
      ...(display === "TERMINATES" && { endsHere: true }),
      stopsBefore: here,
      stopsAfter: here,
      timeA: when.time,
      timeB: when.time,
    });
  }
  return passes.sort((x, y) => x.time - y.time);
}

/** The class of train a service runs with on leaving the point with `allocationIndex`: its allocation there, or else its first. */
export function trainClassOf(r: RttServiceResponse, allocationIndex = 0): string | undefined {
  const all = r.service?.allocationData ?? [];
  const at = all.find((x) => x.allocationIndex === allocationIndex) ?? all[0];
  // "444", though "Class 444" would read the same.
  return at?.leadingClass?.replace(/^\s*class\s*/i, "").trim() || undefined;
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
