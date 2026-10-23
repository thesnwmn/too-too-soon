// What the page says about a pass: plain functions, so they're tested without a browser.
import type { Pass, Spot } from "@too-too-soon/core";

const clockFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

/** 14:07, in UK time whatever the phone's set to. */
export const clock = (t: number): string => clockFmt.format(new Date(t));

/** The big countdown: "3:24", "now!" in the last half minute, "gone" a little after. */
export function countdown(t: number, now: number): string {
  const s = Math.round((t - now) / 1000);
  if (s <= -20) return "gone";
  if (s <= 30) return "now!";
  const m = Math.floor(s / 60);
  if (m >= 60) return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}`;
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** "in 4 min", for the list. */
export function inMinutes(t: number, now: number): string {
  const m = Math.round((t - now) / 60_000);
  if (m <= 0) return "now";
  return `in ${m} min`;
}

/** Which way, as an arrow and a place: A is on the left, as on the set-up form. */
export function direction(p: Pass, spot: Spot, names: { a?: string; b?: string } = {}): { arrow: string; towards: string } {
  const a = spot.aName ?? names.a ?? spot.a;
  const b = spot.bName ?? names.b ?? spot.b;
  return p.direction === "ab" ? { arrow: "➡", towards: b } : { arrow: "⬅", towards: a };
}

/** What it is: "Freight", "Empty train", or "10 coaches to London Waterloo". */
export function what(p: Pass): string {
  if (!p.passenger) return /^[05]/.test(p.headcode ?? "") ? "Empty train" : "Freight train";
  const coaches = p.coaches ? `${p.coaches} coaches` : "Passenger train";
  return p.destination ? `${coaches} to ${p.destination}` : coaches;
}

/** How sure, and how late: "6 min late", "on time", "timetable only". */
export function sureness(p: Pass): string {
  if (p.basis === "timetable") return "timetable only";
  if (p.late === undefined) return p.basis === "actual" ? "on its way" : "live";
  if (p.late > 0) return `${p.late} min late`;
  if (p.late < 0) return `${-p.late} min early`;
  return "on time";
}

/** Whether it slows down near here: worth knowing at a bridge by a station. */
export function stopping(p: Pass): string | undefined {
  if (p.stopsBefore && p.stopsAfter) return "stopping train";
  if (p.stopsBefore) return "just left a station";
  if (p.stopsAfter) return "about to stop";
  return "non-stop";
}

/**
 * How long to wait before asking again: every minute when a train is within 10 minutes, every
 * two otherwise, to stay inside RTT's free rate limits (docs/architecture.md#rate-limits).
 */
export function refreshAfter(passes: Pass[], now: number): number {
  const next = passes.find((p) => p.time > now);
  return next && next.time - now < 10 * 60_000 ? 60_000 : 120_000;
}
