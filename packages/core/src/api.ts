// What the Worker's /api/next answers, and the page reads. Shared so the two can't drift.
import type { Pass } from "./passes.ts";

export interface NextResponse {
  /** When the Worker asked RTT, epoch ms. */
  generatedAt: number;
  passes: Pass[];
  /** The timing points' names, from RTT. */
  aName?: string;
  bName?: string;
  /** RTT couldn't be asked just now (rate limit, error): this is the last good list. */
  stale?: boolean;
  /** RTT says its live data is limited: times may be timetable only. */
  limited?: boolean;
}

export interface ErrorResponse {
  error: string;
}

export interface InfoResponse {
  /** A token is configured. */
  configured: boolean;
  /** RTT accepted it. */
  ok: boolean;
  apiVersion?: string;
  entitlements?: string[];
  /** Passing trains need detailed mode. */
  detailed: boolean;
  error?: string;
  /** How the token was taken: swapped for an access token, or used as one, and what RTT said to the swap. Never the token. */
  token?: { kind: "refresh" | "access"; swapStatus?: number; tidied?: boolean };
  /** The start of RTT's answer when it turned us down: its own explanation. */
  rttSays?: string;
}
