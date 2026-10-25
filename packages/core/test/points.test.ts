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
  // Made up, to test the edges: quoted fields (a comma, a line break), a closed station, an entrance that isn't a station, a stop with no place, two stations of one name far apart.
  '9100STALBCY,,,,"St Albans City Rail Station",,,,,,"Victoria Street, St Albans",,,,,,,E0000001,St Albans,,,,,,,1,UKOS,515300,207400,-0.32733,51.75038,RLY,,,,"Two lines,\nof notes",,110,2006-09-08T14:30:00,2007-09-26T13:00:00,1,revise,active',
  "9100GONE,,,,Gone Rail Station,,,,,,-,,,,,,,E0000002,Gone,,,,,,,1,UKOS,1,1,-1.5,52.5,RLY,,,,,,110,2006-09-08T14:30:00,2007-09-26T13:00:00,1,delete,inactive",
  "9100WOKING1,,,,Woking Rail Station Entrance,,,,,,-,,,,,,,E0025920,Woking,,,,,,,1,UKOS,500660,158695,-0.557,51.318,RSE,,,,,,110,2006-09-08T14:30:00,2007-09-26T13:00:00,1,revise,active",
  "9100NWPTRTG,,,,Newport Rail Station,,,,,,-,,,,,,,E0000004,Newport,,,,,,,1,UKOS,1,1,-2.99881,51.58866,RLY,,,,,,110,2006-09-08T14:30:00,2007-09-26T13:00:00,1,revise,active",
  "9100NWPTEX,,,,Newport Rail Station,,,,,,-,,,,,,,E0000005,Newport,,,,,,,1,UKOS,1,1,1.21,51.98,RLY,,,,,,110,2006-09-08T14:30:00,2007-09-26T13:00:00,1,revise,active",
  "9100NOWHERE,,,,Nowhere Rail Station,,,,,,-,,,,,,,E0000003,Nowhere,,,,,,,1,UKOS,,,,,RLY,,,,,,110,2006-09-08T14:30:00,2007-09-26T13:00:00,1,revise,active",
];
const csv = [header, ...rows].join("\r\n") + "\r\n";

const stops = [
  { description: "Brookwood", shortCode: "BKO" },
  { description: "Woking", shortCode: "WOK" },
  { description: "Clapham Junction", shortCode: "CLJ" },
  { description: "St. Albans City", shortCode: "SAC" },
  { description: "Newport", shortCode: "NWP" },
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
    expect(s.map((x) => x.tiploc)).toEqual(["BRKWOOD", "CLPHMJ1", "CLPHMJ2", "WOKING", "STALBCY", "NWPTRTG", "NWPTEX"]);
    expect(s[0]).toEqual({ tiploc: "BRKWOOD", name: "Brookwood", lat: 51.30375792694, lon: -0.63574781605 });
    expect(s[4]).toEqual({ tiploc: "STALBCY", name: "St Albans City", lat: 51.75038, lon: -0.32733 });
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
  it("never matches a name two far-apart stations have (Newport, Wales and Newport, Essex)", () => {
    expect(at("NWP")).toBeUndefined();
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
    expect(pointsProblems("x".repeat(600_000))[0]).toMatch(/over 500 KB/);
  });
});

describe("compactPoints, with BPLAN's timing points", () => {
  const timing = [
    ["WOKINGJ", 51.31113, -0.56217], // Woking Jn, 700 m from Woking
    ["WOKING", 51.31762, -0.55785], // a station NaPTAN has: NaPTAN wins
    ["WOKI100", 55.8, -4.2], // Woking Signal Wk506, in Glasgow: wrong
    ["CLPHMYD", 51.465, -0.18], // Clapham Yard: no station's name starts it, but near Clapham Junction
    ["SEAJN", 51.82, -6.19], // in the sea, far from any station
    ["WOKJN", 51.38, -0.56], // Woking Jn again, 7 km north of Woking: too far for a namesake
    ["NOTLIST", 51.3, -0.5], // not in the place list
  ] as [string, number, number][];
  const more = [
    ...locations,
    { description: "Woking Signal Wk506", longCode: "WOKI100" },
    { description: "Clapham Yard", longCode: "CLPHMYD" },
    { description: "Sea Jn", longCode: "SEAJN" },
    { description: "Woking Jn", longCode: "WOKJN" },
  ];
  const p = compactPoints(naptanStations(csv), more, compactPlaces(more, stops), timing);
  const at = (code: string) => p.points.find((x) => x[0] === code);
  it("adds a junction near the station it's named after", () => expect(at("WOKINGJ")).toEqual(["WOKINGJ", 51.31113, -0.56217]));
  it("keeps NaPTAN's place for a station", () => expect(at("WOK")).toEqual(["WOK", 51.31847, -0.55696]));
  it("adds a point named after no station when it's near one", () => expect(at("CLPHMYD")).toEqual(["CLPHMYD", 51.465, -0.18]));
  it("leaves out a point far from its namesake, or from every station, and says so", () => {
    expect(at("WOKI100")).toBeUndefined();
    expect(at("SEAJN")).toBeUndefined();
    expect(at("WOKJN")).toBeUndefined();
    expect(p.dropped).toEqual(["WOKI100", "SEAJN", "WOKJN"]);
  });
  it("places nothing that isn't in the place list", () => expect(at("NOTLIST")).toBeUndefined());
});
