export const BANDS = [
  "Good",
  "Satisfactory",
  "Moderate",
  "Poor",
  "Very Poor",
  "Severe",
] as const;

export type Band = (typeof BANDS)[number];

export const POLLUTANTS = [
  "PM2.5",
  "PM10",
  "NO2",
  "SO2",
  "CO",
  "OZONE",
  "NH3",
  "PB",
] as const;

export type PollutantId = (typeof POLLUTANTS)[number];

export type PollutantReading = {
  id: PollutantId;
  /** CPCB sub-index, 0–500. Null when the station reported NA. */
  subIndex: number | null;
};

export type StationAqi = {
  slug: string;
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  /** Official station AQI. Null when CPCB's minimum-data rule is not met. */
  aqi: number | null;
  band: Band | null;
  prominent: PollutantId | null;
  /** CPCB last_update string, as published. */
  updatedAt: string | null;
  pollutants: PollutantReading[];
  insufficient: boolean;
};

export type CityAqi = {
  slug: string;
  city: string;
  state: string;
  /** Mean of participating station AQIs, rounded. Null when none qualify. */
  aqi: number | null;
  band: Band | null;
  prominent: PollutantId | null;
  stationsReporting: number;
  stationsTotal: number;
  updatedAt: string | null;
};

export type Spike = {
  active: boolean;
  /** India-scale index from an hourly concentration model. Not the official AQI. */
  hourlyAqi: number | null;
  officialAqi: number | null;
  source: "model";
  summary: string;
};

export type PlaceReport = {
  query: string;
  city: CityAqi | null;
  nearest: StationAqi | null;
  distanceKm: number | null;
  stations: StationAqi[];
  spike: Spike | null;
  /** ISO time the CPCB snapshot was stored. */
  snapshotAt: string | null;
};

export type SearchHit = {
  kind: "city" | "station";
  slug: string;
  label: string;
  detail: string;
  aqi: number | null;
  band: Band | null;
};

export type SnapshotMeta = {
  snapshotAt: string | null;
  rowCount: number;
  stationCount: number;
  cityCount: number;
  stale: boolean;
};
