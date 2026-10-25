import { describe, expect, it } from "vitest";
import { nameAtTrack, roadSpotName } from "../src/naming.ts";

// A straight east–west track near Woking, and roads across it: 0.001° of longitude is about 70 m here.
const LAT = 51.32;
const track = [[{ lat: LAT, lon: -0.6 }, { lat: LAT, lon: -0.58 }]];
const across = (lon: number) => [{ lat: LAT - 0.001, lon }, { lat: LAT + 0.001, lon }];
const at = { lat: LAT, lon: -0.59 };

describe("roadSpotName", () => {
  it("calls a road over the line a bridge, once", () => {
    expect(roadSpotName("Hermitage Road", true)).toBe("Hermitage Road bridge");
    expect(roadSpotName("Hermitage Road", false)).toBe("Hermitage Road");
    expect(roadSpotName("Hook Heath Bridge", true)).toBe("Hook Heath Bridge");
  });
});

describe("nameAtTrack", () => {
  it("names the spot after the nearest road crossing the track", () => {
    const roads = [
      { name: "Far Lane", points: across(-0.5885) },
      { name: "Hermitage Road", points: across(-0.5905), brunnel: "bridge" },
    ];
    expect(nameAtTrack(at, track, roads)).toBe("Hermitage Road bridge");
  });

  it("finds a bridge from the unnamed lines when the named one has lost it", () => {
    const roads = [{ name: "Hermitage Road", points: across(-0.5905) }];
    expect(nameAtTrack(at, track, roads, [across(-0.59052)])).toBe("Hermitage Road bridge");
    // A bridge elsewhere on the line doesn't count.
    expect(nameAtTrack(at, track, roads, [across(-0.595)])).toBe("Hermitage Road");
  });

  it("names nothing when no road crosses within reach", () => {
    // About 210 m away.
    expect(nameAtTrack(at, track, [{ name: "Far Lane", points: across(-0.587) }])).toBeUndefined();
    // Near, but beside the line rather than across it.
    const beside = [{ lat: LAT + 0.0005, lon: -0.592 }, { lat: LAT + 0.0005, lon: -0.588 }];
    expect(nameAtTrack(at, track, [{ name: "Railside", points: beside }])).toBeUndefined();
    expect(nameAtTrack(at, track, [])).toBeUndefined();
  });
});
