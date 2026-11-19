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
  return band ?? "No AQI";
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
    if (station.insufficient || finiteAqi(station.aqi) == null)
      quiet.push(station);
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
    ? `${city.city} air quality: AQI ${aqi} (${bandLabel(city.band)})`
    : `${city.city} air quality`;
}

export function cityDescription(city: CityAqi): string {
  const aqi = finiteAqi(city.aqi);
  const where = `${city.city}, ${city.state}`;
  if (aqi == null) {
    return `Air quality in ${where}: station readings, pollutants, weather and history on the CPCB National Air Quality Index.`;
  }
  const stations =
    city.stationsReporting === 1
      ? "1 reporting station"
      : `${city.stationsReporting} reporting stations`;
  return `Live air quality in ${where}: AQI ${aqi} (${bandLabel(city.band)}), averaged across ${stations}. Pollutants, weather and history.`;
}

export function stationTitle(station: StationAqi): string {
  const { aqi, band } = officialStation(station);
  return aqi != null
    ? `${station.name}, ${station.city} air quality: AQI ${aqi} (${bandLabel(band)})`
    : `${station.name}, ${station.city} air quality`;
}

export function stationDescription(station: StationAqi): string {
  const { aqi, band } = officialStation(station);
  const where = `${station.name} in ${station.city}, ${station.state}`;
  return aqi != null
    ? `Live air quality at ${where}: AQI ${aqi} (${bandLabel(band)}). Pollutants, weather and history.`
    : `Air quality at ${where}: pollutants, weather and history on the CPCB National Air Quality Index.`;
}

export function aqiName(aqi: number | null, band: Band | null): string {
  if (aqi == null) return "No AQI";
  return `AQI ${aqi}, ${bandLabel(band)}`;
}

/** One neutral line under the band name. Describes the band, gives no advice. */
export function bandNote(band: Band | null): string {
  switch (band) {
    case "Good":
      return "Clean air, with minimal impact.";
    case "Satisfactory":
      return "Acceptable air. Sensitive people may notice minor discomfort.";
    case "Moderate":
      return "Noticeable pollution. People with lung or heart conditions may feel discomfort.";
    case "Poor":
      return "Unhealthy air. Many people may feel discomfort on longer exposure.";
    case "Very Poor":
      return "Very unhealthy air. Respiratory illness is possible on longer exposure.";
    case "Severe":
      return "Severe pollution. Health effects can reach healthy people too.";
    default:
      return "Not enough pollutants were published to calculate an AQI.";
  }
}

/** Core CPCB pollutants. Lead is measured at only a few stations. */
const CORE_POLLUTANTS: PollutantId[] = [
  "PM2.5",
  "PM10",
  "NO2",
  "SO2",
  "CO",
  "OZONE",
  "NH3",
];

/** Core pollutants a station did not report a sub-index for. */
export function missingPollutants(
  pollutants: Array<{ id: PollutantId; subIndex: number | null }>,
): PollutantId[] {
  const reported = new Set(
    pollutants
      .filter((item) => finiteAqi(item.subIndex) != null)
      .map((item) => item.id),
  );
  return CORE_POLLUTANTS.filter((id) => !reported.has(id));
}

/** "PM2.5", "PM2.5 and PM10", "PM2.5, PM10 and Ozone". */
export function joinLabels(ids: PollutantId[]): string {
  const labels = ids.map(pollutantLabel);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
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
  const match = /^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(
    value.trim(),
  );
  if (!match) return value;
  const month = STAMP_MONTHS[Number(match[2]) - 1];
  if (!month) return value;
  const clock = match[4] && match[5] ? `, ${match[4]}:${match[5]}` : "";
  const thisYear = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
  }).format(new Date());
  const year = match[3] === thisYear ? "" : ` ${match[3]}`;
  return `${Number(match[1])} ${month}${year}${clock}`;
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
