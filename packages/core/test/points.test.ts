import { describe, expect, it } from "vitest";
import { compactPlaces } from "../src/places.ts";
import { compactPoints, naptanStations, pointsProblems } from "../src/points.ts";

// NaPTAN's stops CSV for area 910 (rail), as it was on 2026-10-25: the header, and a few of 2,769 rows.
const header =
  "ATCOCode,NaptanCode,PlateCode,CleardownCode,CommonName,CommonNameLang,ShortCommonName,ShortCommonNameLang,Landmark,LandmarkLang,Street,StreetLang,Crossing,CrossingLang,Indicator,IndicatorLang,Bearing,NptgLocalityCode,LocalityName,ParentLocalityName,GrandParentLocalityName,Town,TownLang,Suburb,SuburbLang,LocalityCentre,GridType,Easting,Northing,Longitude,Latitude,StopType,BusStopType,TimingStatus,DefaultWaitTime,Notes,NotesLang,AdministrativeAreaCode,CreationDateTime,ModificationDateTime,RevisionNumber,Modification,Status";
const rows = [
  "9100BRKWOOD,,,,Brookwood Rail Station,,,,,,-,,,,,,,E0025889,Brookwood,,,,,,,1,UKOS,495200,156954,-0.63574781605,51.30375792694,RLY,,,,,,110,2006-09-08T14:30:00,2007-09-26T13:00:00,1,revise,active",
  "9100CLPHMJ1,,,,Clapham Junction Rail Station,,,,,,-,,,,,,,E0034892,Clapham Junction,London,,,,,,0,UKOS,527205,175500,-0.17022139909,51.46418690022,RLY,,,,,,110,2012-09-26T13:55:00,2012-09-26T13:58:00,1,revise,active",
  "9100CLPHMJ2,,,,Clapham Junction Rail Station,,,,,,-,,,,,,,E0034892,Clapham Junction,London,,,,,,1,UKOS,527200,175500,-0.17029333674,51.4641880229,RLY,,,,,,110,2006-09-08T14:30:00,2009-04-14T16:40:00,3,revise,active",
  "9100WOKING,,,,Woking Rail Station,,,,,,-,,,,,,,E0025920,Woking,,,,,,,1,UKOS,500660,158695,-0.55695962081,51.31846934954,RLY,,,,,,110,2006-09-08T14:30:00,2007-09-26T13:00:00,1,revise,active",
  // Made up, to test the edges: a quoted name with a comma, a closed station, an entrance that isn't a station, a stop with no place.
  '9100STALBCY,,,,"St Albans City, Rail Station",,,,,,-,,,,,,,E0000001,St Albans,,,,,,,1,UKOS,515300,207400,-0.32733,51.75038,RLY,,,,,,110,2006-09-08T14:30:00,2007-09-26T13:00:00,1,revise,active',
  "9100GONE,,,,Gone Rail Station,,,,,,-,,,,,,,E0000002,Gone,,,,,,,1,UKOS,1,1,-1.5,52.5,RLY,,,,,,110,2006-09-08T14:30:00,2007-09-26T13:00:00,1,delete,inactive",
  "9100WOKING1,,,,Woking Rail Station Entrance,,,,,,-,,,,,,,E0025920,Woking,,,,,,,1,UKOS,500660,158695,-0.557,51.318,RSE,,,,,,110,2006-09-08T14:30:00,2007-09-26T13:00:00,1,revise,active",
  "9100NOWHERE,,,,Nowhere Rail Station,,,,,,-,,,,,,,E0000003,Nowhere,,,,,,,1,UKOS,,,,,RLY,,,,,,110,2006-09-08T14:30:00,2007-09-26T13:00:00,1,revise,active",
];
const csv = [header, ...rows].join("\r\n") + "\r\n";

const stops = [
  { description: "Brookwood", shortCode: "BKO" },
  { description: "Woking", shortCode: "WOK" },
  { description: "Clapham Junction", shortCode: "CLJ" },
  { description: "St. Albans City", shortCode: "SAC" },
];
const locations = [
  { description: "Brookwood", shortCode: "BKO", longCode: "BRKWOOD" },
  { description: "Woking", shortCode: "WOK", longCode: "WOKING" },
  { description: "Woking Junction", longCode: "WOKINGJ" },
  { description: "Clapham Junction", shortCode: "CLJ", longCode: "CLPHMJN" },
  { description: "Clapham Junction", longCode: "CLPHMJ1" },
  { description: "St. Albans City", shortCode: "SAC", longCode: "STALBCY" },
];
const places = compactPlaces(locations, stops);

describe("naptanStations", () => {
  it("reads the active rail stations, each with its TIPLOC, its name and where it is", () => {
    const s = naptanStations(csv);
    expect(s.map((x) => x.tiploc)).toEqual(["BRKWOOD", "CLPHMJ1", "CLPHMJ2", "WOKING", "STALBCY"]);
    expect(s[0]).toEqual({ tiploc: "BRKWOOD", name: "Brookwood", lat: 51.30375792694, lon: -0.63574781605 });
    expect(s[4].name).toBe("St Albans City,");
  });
  it("gives nothing for something that isn't the CSV", () => {
    expect(naptanStations("<html>busy</html>")).toEqual([]);
    expect(naptanStations("")).toEqual([]);
  });
});

describe("compactPoints", () => {
  const points = compactPoints(naptanStations(csv), locations, places).points;
  const at = (code: string) => points.find((p) => p[0] === code);
  it("finds a station by its TIPLOC, and gives it the code the place list uses", () => {
    expect(at("BKO")).toEqual(["BKO", 51.30376, -0.63575]);
    expect(at("WOK")).toEqual(["WOK", 51.31847, -0.55696]);
    expect(at("SAC")).toEqual(["SAC", 51.75038, -0.32733]);
  });
  it("falls back to the name when NaPTAN's code isn't RTT's (Clapham Junction is CLPHMJN to RTT, CLPHMJ1 and 2 to NaPTAN)", () => {
    expect(at("CLJ")).toEqual(["CLJ", 51.46419, -0.17022]);
  });
  it("places nothing it has no station for, and each code once", () => {
    expect(at("WOKINGJ")).toBeUndefined();
    expect(points.map((p) => p[0])).toEqual(["BKO", "CLJ", "SAC", "WOK"]);
  });
  it("never lets a name take a place a code already has", () => {
    const twin = [...naptanStations(csv), { tiploc: "XWOK", name: "Woking", lat: 55, lon: -3 }];
    expect(compactPoints(twin, locations, places).points.find((p) => p[0] === "WOK")).toEqual(["WOK", 51.31847, -0.55696]);
  });
});

describe("pointsProblems", () => {
  const many = (n: number) => ({ v: 1, points: Array.from({ length: n }, (_, i) => [`P${String(i).padStart(4, "0")}`, 51.3, -0.55]) });
  it("passes a list fit to ship", () => expect(pointsProblems(JSON.stringify(many(1500)))).toEqual([]));
  it("fails a list with almost nothing placed", () => expect(pointsProblems(JSON.stringify(many(12)))).toEqual(["only 12 points, fewer than 1000"]));
  it("fails a point far outside Great Britain", () => {
    const l = many(1500);
    l.points[3] = ["WOK", 0, 0];
    expect(pointsProblems(JSON.stringify(l))).toEqual(["WOK is outside Great Britain (0, 0)"]);
  });
  it("fails the wrong shape, or something far too big", () => {
    expect(pointsProblems("nope")).toEqual(["not JSON"]);
    expect(pointsProblems('{"v":1}')).toEqual(["no points"]);
    expect(pointsProblems(JSON.stringify({ v: 1, points: [["wok", 51, 0]] }), 1)[0]).toMatch(/isn't \[code, lat, lon\]/);
    expect(pointsProblems("x".repeat(500_000))[0]).toMatch(/over 400 KB/);
  });
});
