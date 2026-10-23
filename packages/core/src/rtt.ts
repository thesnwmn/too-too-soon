// The parts of Realtime Trains' API (https://github.com/realtimetrains/api-specification)
// that we read: the location line-up from GET /gb-nr/location. Everything is optional,
// because the API leaves out what it doesn't know.

/** One activity (arrival, departure or pass) at a location. Times are ISO 8601 with an offset. */
export interface RttTimes {
  scheduleInternal?: string;
  scheduleAdvertised?: string;
  realtimeForecast?: string;
  realtimeEstimate?: string;
  realtimeActual?: string;
  realtimeNoReport?: boolean;
  realtimeInternalLateness?: number | null;
  realtimeAdvertisedLateness?: number | null;
  isCancelled?: boolean;
}

export type RttDisplayAs = "CALL" | "CANCELLED" | "DIVERTED" | "STARTS" | "TERMINATES" | "PASS" | null;

export interface RttLocationPair {
  location?: { description?: string; shortCodes?: string[]; longCodes?: string[] };
  temporalData?: RttTimes;
}

export interface RttService {
  temporalData?: {
    arrival?: RttTimes;
    departure?: RttTimes;
    pass?: RttTimes;
    displayAs?: RttDisplayAs;
    scheduledCallType?: string | null;
    realtimeCallType?: string | null;
  };
  locationMetadata?: {
    numberOfVehicles?: number;
    line?: { planned?: string; actual?: string };
    platform?: { planned?: string; actual?: string };
  };
  scheduleMetadata?: {
    uniqueIdentity?: string;
    identity?: string;
    departureDate?: string;
    trainReportingIdentity?: string;
    operator?: { code?: string; name?: string };
    modeType?: string;
    inPassengerService?: boolean;
  };
  origin?: RttLocationPair[];
  destination?: RttLocationPair[];
}

export interface RttLocationResponse {
  systemStatus?: { realtimeNetworkRail?: string; rttCore?: string };
  query?: { location?: { description?: string; longCodes?: string[]; shortCodes?: string[] }; timeFrom?: string; timeTo?: string };
  services?: RttService[];
}
