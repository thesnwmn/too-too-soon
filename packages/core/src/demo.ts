// Recorded-shape RTT line-ups for a made-up stretch of line, relative to a given time:
// what the demo page shows before the live API is set up, and what the tests run on.
// Times are on WTT half-minutes, like the real thing.
import type { RttLocationResponse, RttService, RttTimes } from "./rtt.ts";

const MIN = 60_000;
const iso = (t: number) => new Date(Math.round(t / 30_000) * 30_000).toISOString();

export interface DemoTrain {
  id: string;
  headcode: string;
  /** Minutes from now that it's timetabled at the first point it reaches. */
  at: number;
  /** "ab" heads from A to B. */
  direction: "ab" | "ba";
  /** Minutes from the first point to the second. */
  run: number;
  late?: number;
  passenger?: boolean;
  stopsAtA?: boolean;
  stopsAtB?: boolean;
  coaches?: number;
  operator?: string;
  origin: string;
  destination: string;
  cancelled?: boolean;
  /** Only listed at one end: it starts or ends between A and B. */
  onlyAt?: "a" | "b";
}

function times(scheduled: number, now: number, late: number | undefined): RttTimes {
  const t: RttTimes = { scheduleInternal: iso(scheduled) };
  if (late === undefined) return t;
  const real = scheduled + late * MIN;
  if (real <= now) t.realtimeActual = iso(real);
  else t.realtimeForecast = iso(real);
  t.realtimeInternalLateness = late;
  return t;
}

function service(train: DemoTrain, at: number, stops: boolean, now: number, date: string): RttService {
  const td = stops ? { arrival: times(at - 0.5 * MIN, now, train.late), departure: times(at, now, train.late), displayAs: "CALL" as const } : { pass: times(at, now, train.late), displayAs: null };
  return {
    temporalData: train.cancelled ? { ...td, displayAs: "CANCELLED" } : td,
    locationMetadata: { numberOfVehicles: train.coaches },
    scheduleMetadata: {
      uniqueIdentity: `gb-nr:${train.id}:${date}`,
      identity: train.id,
      departureDate: date,
      trainReportingIdentity: train.headcode,
      operator: { name: train.operator },
      modeType: "TRAIN",
      inPassengerService: train.passenger !== false,
    },
    origin: [{ location: { description: train.origin } }],
    destination: [{ location: { description: train.destination } }],
  };
}

/** RTT line-ups at A and B for `trains`, as if asked at `now`. */
export function lineUps(trains: DemoTrain[], now: number, names = { a: "Ashby Junction", b: "Bramford" }): { a: RttLocationResponse; b: RttLocationResponse } {
  const date = new Date(now).toISOString().slice(0, 10);
  const a: RttService[] = [];
  const b: RttService[] = [];
  for (const train of trains) {
    const first = now + train.at * MIN;
    const second = first + train.run * MIN;
    const [atA, atB] = train.direction === "ab" ? [first, second] : [second, first];
    if (train.onlyAt !== "b") a.push(service(train, atA, train.stopsAtA ?? false, now, date));
    if (train.onlyAt !== "a") b.push(service(train, atB, train.stopsAtB ?? false, now, date));
  }
  const status = { realtimeNetworkRail: "OK", rttCore: "OK" };
  return {
    a: { systemStatus: status, query: { location: { description: names.a, longCodes: ["ASHBYJN"] } }, services: a },
    b: { systemStatus: status, query: { location: { description: names.b, longCodes: ["BRAMFD"] } }, services: b },
  };
}

/** An hour on a busy two-track line: commuter trains both ways, a late one, an express, freight and a cancellation. */
export const DEMO_TRAINS: DemoTrain[] = [
  { id: "D10001", headcode: "2B14", at: -3, direction: "ab", run: 4, late: 0, stopsAtA: true, coaches: 8, operator: "Demo Trains", origin: "London Waterloo", destination: "Bramford" },
  { id: "D10002", headcode: "1A23", at: 2, direction: "ba", run: 3, late: 1, coaches: 10, operator: "Demo Express", origin: "Southampton", destination: "London Waterloo" },
  { id: "D10003", headcode: "6M41", at: 6, direction: "ab", run: 5, late: 7, passenger: false, operator: "Freightliner", origin: "Southampton Docks", destination: "Birmingham" },
  { id: "D10004", headcode: "2B17", at: 11, direction: "ba", run: 4, late: 0, stopsAtB: true, coaches: 4, operator: "Demo Trains", origin: "Bramford", destination: "London Waterloo" },
  { id: "D10005", headcode: "1B50", at: 15, direction: "ab", run: 3, late: 2, coaches: 12, operator: "Demo Express", origin: "London Waterloo", destination: "Weymouth" },
  { id: "D10006", headcode: "2B19", at: 19, direction: "ab", run: 4, stopsAtA: true, coaches: 8, operator: "Demo Trains", origin: "London Waterloo", destination: "Bramford", cancelled: true },
  { id: "D10007", headcode: "5Z90", at: 23, direction: "ba", run: 4, passenger: false, operator: "Demo Trains", origin: "Bramford Depot", destination: "Clapham Yard", onlyAt: "b" },
  { id: "D10008", headcode: "2B21", at: 27, direction: "ba", run: 4, stopsAtB: true, coaches: 8, operator: "Demo Trains", origin: "Bramford", destination: "London Waterloo" },
  { id: "D10009", headcode: "4O22", at: 34, direction: "ba", run: 6, passenger: false, operator: "DB Cargo", origin: "Wembley", destination: "Southampton Docks" },
  { id: "D10010", headcode: "1A31", at: 41, direction: "ab", run: 3, coaches: 10, operator: "Demo Express", origin: "London Waterloo", destination: "Southampton" },
  { id: "D10011", headcode: "2B23", at: 48, direction: "ab", run: 4, stopsAtA: true, coaches: 8, operator: "Demo Trains", origin: "London Waterloo", destination: "Bramford" },
  { id: "D10012", headcode: "1A35", at: 56, direction: "ba", run: 3, coaches: 12, operator: "Demo Express", origin: "Southampton", destination: "London Waterloo" },
];

/** The demo spot's line-ups, as if asked at `now`. */
export const demoLineUps = (now: number) => lineUps(DEMO_TRAINS, now);
