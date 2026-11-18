import type { Band, CityAqi, PollutantId, StationAqi } from "@/lib/types";

const POLLUTANT_LABEL: Record<PollutantId, string> = {
  "PM2.5": "PM2.5",
  PM10: "PM10",
  NO2: "NO2",
  SO2: "SO2",
  CO: "CO",
  OZONE: "Ozone",
  NH3: "NH3",
  PB: "Lead",
};

export function bandLabel(band: Band | null): string {
  return band ?? "Insufficient";
}

export function pollutantLabel(id: PollutantId): string {
  return POLLUTANT_LABEL[id];
}

export function cityPath(slug: string): string {
  return `/city/${encodeURIComponent(slug)}`;
}

export function stationPath(slug: string): string {
  return `/station/${encodeURIComponent(slug)}`;
}

export function finiteAqi(aqi: number | null): number | null {
  return aqi != null && Number.isFinite(aqi) ? aqi : null;
}

export function officialStation(station: StationAqi): {
  aqi: number | null;
  band: Band | null;
} {
  const aqi = finiteAqi(station.aqi);
  if (station.insufficient || aqi == null) return { aqi: null, band: null };
  return { aqi, band: station.band };
}

export function compareCities(a: CityAqi, b: CityAqi): number {
  const aqiA = finiteAqi(a.aqi);
  const aqiB = finiteAqi(b.aqi);
  if (aqiA == null && aqiB == null) return a.city.localeCompare(b.city);
  if (aqiA == null) return 1;
  if (aqiB == null) return -1;
  if (aqiA !== aqiB) return aqiB - aqiA;
  return a.city.localeCompare(b.city);
}

export function sortStations(stations: StationAqi[]): StationAqi[] {
  const reporting: StationAqi[] = [];
  const quiet: StationAqi[] = [];
  for (const station of stations) {
    if (station.insufficient || finiteAqi(station.aqi) == null) quiet.push(station);
    else reporting.push(station);
  }
  reporting.sort(
    (a, b) =>
      (finiteAqi(b.aqi) ?? 0) - (finiteAqi(a.aqi) ?? 0) ||
      a.name.localeCompare(b.name),
  );
  quiet.sort((a, b) => a.name.localeCompare(b.name));
  return [...reporting, ...quiet];
}

export function cityTitle(city: CityAqi): string {
  const aqi = finiteAqi(city.aqi);
  return aqi != null
    ? `${city.city} AQI ${aqi} — official CPCB reading`
    : `${city.city} AQI`;
}

export function cityDescription(city: CityAqi): string {
  return `${city.city}, ${city.state}. The National Air Quality Index from CPCB stations.`;
}

export function stationTitle(station: StationAqi): string {
  const { aqi } = officialStation(station);
  return aqi != null
    ? `${station.name} AQI ${aqi} — official CPCB reading`
    : `${station.name} AQI`;
}

export function stationDescription(station: StationAqi): string {
  return `${station.name} in ${station.city}, ${station.state}. The National Air Quality Index from this CPCB station.`;
}

export function aqiName(aqi: number | null, band: Band | null): string {
  if (aqi == null) return "No official AQI";
  return `AQI ${aqi}, ${bandLabel(band)}`;
}

const STAMP_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatStamp(value: string | null): string | null {
  if (!value) return null;
  const match = /^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(value.trim());
  if (!match) return value;
  const month = STAMP_MONTHS[Number(match[2]) - 1];
  if (!month) return value;
  const clock = match[4] && match[5] ? `, ${match[4]}:${match[5]}` : "";
  return `${Number(match[1])} ${month} ${match[3]}${clock}`;
}

export function stampIsToday(value: string | null, now = new Date()): boolean {
  if (!value) return false;
  const match = /^(\d{2})-(\d{2})-(\d{4})/.exec(value.trim());
  if (!match) return false;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return today === `${match[3]}-${match[2]}-${match[1]}`;
}
