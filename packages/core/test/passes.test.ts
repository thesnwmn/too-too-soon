import { describe, expect, it } from "vitest";
import { best, rttTime, type RttLocationResponse, type RttService, type RttTimes, DEMO_TRAINS, type DemoTrain, liveDataLimited, lineUps, parseSpot, predictPasses, spotParams, trainClassOf, upcoming, withDemoClasses } from "../src/index.ts";

const NOW = Date.parse("2026-10-24T14:00:00Z");
const MIN = 60_000;
const train = (over: Partial<DemoTrain>): DemoTrain => ({ id: "X1", headcode: "1X01", at: 10, direction: "ab", run: 4, origin: "Here", destination: "There", ...over });
const predict = (trains: DemoTrain[], f = 0.25, now = NOW) => {
  const { a, b } = lineUps(trains, now);
  return predictPasses(a, b, f);
};

describe("best", () => {
  it("takes actual, then forecast, then estimate, then the timetable", () => {
    const s = "2026-10-24T14:00:00Z";
    const f = "2026-10-24T14:03:00Z";
    const a = "2026-10-24T14:04:00Z";
    expect(best({ scheduleInternal: s, realtimeForecast: f, realtimeActual: a })).toEqual({ time: Date.parse(a), basis: "actual", scheduled: Date.parse(s) });
    expect(best({ scheduleInternal: s, realtimeForecast: f })).toMatchObject({ time: Date.parse(f), basis: "forecast" });
    expect(best({ scheduleInternal: s, realtimeEstimate: f })).toMatchObject({ time: Date.parse(f), basis: "forecast" });
    expect(best({ scheduleAdvertised: s })).toMatchObject({ time: Date.parse(s), basis: "timetable" });
  });
  it("reads offsets, so British Summer Time is already handled", () => expect(best({ scheduleInternal: "2026-07-01T15:00:00+01:00" })?.time).toBe(Date.parse("2026-07-01T14:00:00Z")));
  it("has nothing for a cancelled or empty activity", () => {
    expect(best({ scheduleInternal: "2026-10-24T14:00:00Z", isCancelled: true })).toBeUndefined();
    expect(best({})).toBeUndefined();
    expect(best(undefined)).toBeUndefined();
  });
});

describe("predictPasses", () => {
  it("interpolates a train heading from A to B", () => {
    const [p] = predict([train({ at: 10, run: 4 })], 0.25);
    expect(p.direction).toBe("ab");
    expect(p.time).toBe(NOW + 11 * MIN);
    expect(p.basis).toBe("timetable");
    expect(p.timeA).toBe(NOW + 10 * MIN);
    expect(p.timeB).toBe(NOW + 14 * MIN);
  });
  it("interpolates from B for a train heading to A, so f is still measured from A", () => {
    const [p] = predict([train({ direction: "ba", at: 10, run: 4 })], 0.25);
    expect(p.direction).toBe("ba");
    expect(p.time).toBe(NOW + 13 * MIN);
    expect(p.timeB).toBe(NOW + 10 * MIN);
    expect(p.timeA).toBe(NOW + 14 * MIN);
  });
  it("uses live times for a late train, and says how late", () => {
    const [p] = predict([train({ at: 10, run: 4, late: 6 })], 0.5);
    expect(p.time).toBe(NOW + 18 * MIN);
    expect(p.basis).toBe("forecast");
    expect(p.late).toBe(6);
  });
  it("is actual once the train has really passed the first point", () => {
    const [p] = predict([train({ at: -2, run: 4, late: 1 })], 0.5);
    expect(p.basis).toBe("actual");
    expect(p.time).toBe(NOW + 1 * MIN);
  });
  it("leaves from the departure, not the arrival, at a stop", () => {
    const [p] = predict([train({ at: 10, run: 4, stopsAtA: true })], 0);
    expect(p.time).toBe(NOW + 10 * MIN);
    expect(p.stopsBefore).toBe(true);
    expect(p.stopsAfter).toBe(false);
  });
  it("arrives at the arrival, not the departure, at a stop after", () => {
    const [p] = predict([train({ at: 10, run: 4, stopsAtB: true })], 1);
    expect(p.time).toBe(NOW + 13.5 * MIN);
    expect(p.stopsAfter).toBe(true);
  });
  it("drops cancelled trains and trains at only one end", () => {
    const passes = predict([train({ id: "C", cancelled: true }), train({ id: "A", onlyAt: "a" }), train({ id: "B", onlyAt: "b" }), train({ id: "K" })]);
    expect(passes.map((p) => p.id)).toEqual([`gb-nr:K:2026-10-24`]);
  });
  it("never joins the same train number on two different days", () => {
    const today = lineUps([train({ at: 10 })], NOW);
    const tomorrow = lineUps([train({ at: 10 })], NOW + 24 * 60 * MIN);
    expect(predictPasses(today.a, tomorrow.b, 0.5)).toEqual([]);
  });
  it("works across midnight UTC", () => {
    const late = Date.parse("2026-10-24T23:58:00Z");
    const [p] = predict([train({ at: 1, run: 4 })], 0.5, late);
    expect(new Date(p.time).toISOString()).toBe("2026-10-25T00:01:00.000Z");
  });
  it("says what the train is", () => {
    const [p] = predict([train({ passenger: false, coaches: 0, operator: "Freightliner", origin: "Docks", destination: "Yard", headcode: "6M41" })]);
    expect(p).toMatchObject({ passenger: false, operator: "Freightliner", origin: "Docks", destination: "Yard", headcode: "6M41", coaches: undefined });
  });
  it("sorts soonest first", () => {
    const passes = predict([train({ id: "L", at: 30 }), train({ id: "E", at: 5, direction: "ba" })]);
    expect(passes.map((p) => p.id.split(":")[1])).toEqual(["E", "L"]);
  });
  it("copes with empty and missing line-ups", () => {
    expect(predictPasses({}, {}, 0.5)).toEqual([]);
    expect(predictPasses({ services: [] }, { services: [{}] }, 0.5)).toEqual([]);
  });
  it("gives the demo an hour of trains, without the cancellation or the one-ended one", () => {
    const passes = predict(DEMO_TRAINS, 0.4);
    expect(passes.length).toBe(DEMO_TRAINS.length - 2);
    expect(passes.some((p) => !p.passenger)).toBe(true);
  });
});

/** A service shaped as RTT's spec has it: `times` are its pass times at one location. */
const raw = (id: string, date: string, pass: RttTimes, meta: RttService["scheduleMetadata"] = {}): RttService => ({
  temporalData: { pass, displayAs: null },
  scheduleMetadata: { uniqueIdentity: `gb-nr:${id}:${date}`, departureDate: date, inPassengerService: true, modeType: "TRAIN", ...meta },
});
const at = (...services: RttService[]): RttLocationResponse => ({ services });

describe("predictPasses on spec-shaped data", () => {
  it("works out lateness from a forecast, which RTT gives without a lateness figure", () => {
    const a = at(raw("L1", "2026-10-24", { scheduleInternal: "2026-10-24T14:00:00Z", realtimeForecast: "2026-10-24T14:06:00Z" }));
    const b = at(raw("L1", "2026-10-24", { scheduleInternal: "2026-10-24T14:04:00Z", realtimeForecast: "2026-10-24T14:10:00Z" }));
    expect(predictPasses(a, b, 0.5)[0]).toMatchObject({ late: 6, basis: "forecast", time: Date.parse("2026-10-24T14:08:00Z") });
  });
  it("carries a late actual at A over to a timetable-only B", () => {
    const a = at(raw("L2", "2026-10-24", { scheduleInternal: "2026-10-24T14:00:00Z", realtimeActual: "2026-10-24T14:10:00Z" }));
    const b = at(raw("L2", "2026-10-24", { scheduleInternal: "2026-10-24T14:04:00Z" }));
    const [p] = predictPasses(a, b, 0.5);
    expect(new Date(p.time).toISOString()).toBe("2026-10-24T14:12:00.000Z");
    expect(p).toMatchObject({ basis: "actual", late: 10, timeB: Date.parse("2026-10-24T14:14:00Z") });
  });
  it("joins a train that started yesterday and passes after midnight", () => {
    const a = at(raw("N1", "2026-10-23", { scheduleInternal: "2026-10-24T00:59:00+01:00" }));
    const b = at(raw("N1", "2026-10-23", { scheduleInternal: "2026-10-24T01:03:00+01:00" }));
    expect(new Date(predictPasses(a, b, 0.5)[0].time).toISOString()).toBe("2026-10-24T00:01:00.000Z");
  });
  it("interpolates across the clocks going back", () => {
    const a = at(raw("C1", "2026-10-25", { scheduleInternal: "2026-10-25T01:58:00+01:00" }));
    const b = at(raw("C1", "2026-10-25", { scheduleInternal: "2026-10-25T01:02:00+00:00" }));
    expect(new Date(predictPasses(a, b, 0.5)[0].time).toISOString()).toBe("2026-10-25T01:00:00.000Z");
  });
  it("leaves out replacement buses", () => {
    const bus = { modeType: "REPLACEMENT_BUS" };
    const a = at(raw("B1", "2026-10-24", { scheduleInternal: "2026-10-24T14:00:00Z" }, bus));
    const b = at(raw("B1", "2026-10-24", { scheduleInternal: "2026-10-24T14:10:00Z" }, bus));
    expect(predictPasses(a, b, 0.5)).toEqual([]);
  });
});

describe("rttTime", () => {
  it("reads a time without an offset as UK time, as the live API sends them", () => {
    expect(new Date(rttTime("2026-10-24T00:12:00")).toISOString()).toBe("2026-10-23T23:12:00.000Z");
    expect(new Date(rttTime("2026-12-24T14:07:00")).toISOString()).toBe("2026-12-24T14:07:00.000Z");
  });
  it("gets both sides of the clocks going back right", () => {
    expect(new Date(rttTime("2026-10-25T00:30:00")).toISOString()).toBe("2026-10-24T23:30:00.000Z");
    expect(new Date(rttTime("2026-10-25T02:30:00")).toISOString()).toBe("2026-10-25T02:30:00.000Z");
  });
  it("still honours an offset or Z when there is one", () => {
    expect(rttTime("2026-07-01T15:00:00+01:00")).toBe(Date.parse("2026-07-01T14:00:00Z"));
    expect(rttTime("2026-07-01T15:00:00Z")).toBe(Date.parse("2026-07-01T15:00:00Z"));
  });
  it("interpolates offset-less times as the live API sends them", () => {
    const a = at(raw("U1", "2026-10-24", { scheduleInternal: "2026-10-24T00:10:00" }));
    const b = at(raw("U1", "2026-10-24", { scheduleInternal: "2026-10-24T00:14:00" }));
    expect(new Date(predictPasses(a, b, 0.5)[0].time).toISOString()).toBe("2026-10-23T23:12:00.000Z");
  });
});

describe("upcoming", () => {
  it("keeps what's still to come, and the last minute", () => {
    const passes = predict([train({ id: "P", at: -5, run: 2 }), train({ id: "J", at: -1, run: 1 }), train({ id: "F", at: 5 })], 0.5);
    expect(upcoming(passes, NOW).map((p) => p.id.split(":")[1])).toEqual(["J", "F"]);
  });
});

describe("liveDataLimited", () => {
  it("is false when RTT says OK, and true when it doesn't", () => {
    expect(liveDataLimited({ systemStatus: { realtimeNetworkRail: "OK", rttCore: "OK" } }, {})).toBe(false);
    expect(liveDataLimited({ systemStatus: { realtimeNetworkRail: "OK", rttCore: "SCHEDULE_ONLY" } })).toBe(true);
  });
});

describe("spots", () => {
  it("round-trips through the URL", () => {
    const spot = { name: "Our bridge", a: "CLPHMJN", b: "WDON", f: 0.4, aName: "Clapham", bName: "Wimbledon" };
    expect(parseSpot(spotParams(spot))).toEqual({ spot });
  });
  it("tidies codes and defaults the name and f", () => expect(parseSpot(new URLSearchParams("a=clphmjn&b=wdon"))).toEqual({ spot: { name: "CLPHMJN – WDON", a: "CLPHMJN", b: "WDON", f: 0.5, aName: undefined, bName: undefined } }));
  it("says what's wrong", () => {
    expect(parseSpot(new URLSearchParams("a=X&b=WDON"))).toHaveProperty("error");
    expect(parseSpot(new URLSearchParams("a=WDON&b=WDON"))).toHaveProperty("error");
    expect(parseSpot(new URLSearchParams("a=CLPHMJN&b=WDON&f=1.5"))).toHaveProperty("error");
    expect(parseSpot(new URLSearchParams("a=CLPHMJN&b=WD%2FON"))).toHaveProperty("error");
  });
});

describe("trainClassOf", () => {
  // As RTT sent it for 1L69, two Class 159s from Waterloo, one left behind at Salisbury.
  const r = { service: { allocationData: [{ allocationIndex: 0, leadingClass: "159", passengerVehicles: 6 }, { allocationIndex: 1, leadingClass: "158", passengerVehicles: 3 }] } };
  it("takes the allocation the train has past the spot", () => {
    expect(trainClassOf(r, 0)).toBe("159");
    expect(trainClassOf(r, 1)).toBe("158");
  });
  it("falls back to the first allocation, and to nothing", () => {
    expect(trainClassOf(r, 7)).toBe("159");
    expect(trainClassOf(r)).toBe("159");
    expect(trainClassOf({ service: { allocationData: [] } })).toBeUndefined();
    expect(trainClassOf({})).toBeUndefined();
  });
  it("carries the allocation index from the line-up, and the demo's classes", () => {
    const ups = lineUps([{ id: "Z1", headcode: "1Z01", at: 5, direction: "ab", run: 4, origin: "X", destination: "Y", trainClass: "444" }], NOW);
    ups.a.services![0].locationMetadata!.allocationIndex = 1;
    const [p] = predictPasses(ups.a, ups.b, 0.5);
    expect(p.allocationIndex).toBe(1);
    expect(withDemoClasses([p], [{ id: "Z1", headcode: "1Z01", at: 5, direction: "ab", run: 4, origin: "X", destination: "Y", trainClass: "444" }])[0].trainClass).toBe("444");
  });
});
