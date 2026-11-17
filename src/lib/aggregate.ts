import { bandFor, clampIndex, normalizePollutant } from "./aqi.ts";
import {
  POLLUTANTS,
  type CityAqi,
  type PollutantId,
  type PollutantReading,
  type StationAqi,
} from "./types.ts";

/**
 * One row from the CPCB data.gov.in feed.
 * `avg_value` is already the CPCB sub-index. Do not convert it from a concentration.
 */
export type CpcbRecord = {
  state?: unknown;
  city?: unknown;
  station?: unknown;
  last_update?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  pollutant_id?: unknown;
  avg_value?: unknown;
};

const POLLUTANT_RANK = new Map<PollutantId, number>(
  POLLUTANTS.map((id, index) => [id, index]),
);

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Parse `DD-MM-YYYY HH:mm:ss` into a comparable UTC millisecond value.
 * Date.parse misreads this day-first string, so the pieces are read by hand.
 */
export function parseCpcbTimestamp(value: string): number | null {
  const match = /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(
    value.trim(),
  );
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  const ms = Date.UTC(year, month - 1, day, hour, minute, second);
  const check = new Date(ms);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return ms;
}

type PollutantAcc = {
  subIndex: number | null;
  at: number;
};

type StationAcc = {
  state: string;
  city: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  updatedAt: string | null;
  updatedMs: number;
  pollutants: Map<PollutantId, PollutantAcc>;
};

export function aggregateRecords(records: readonly CpcbRecord[]): {
  stations: StationAqi[];
  cities: CityAqi[];
} {
  const groups = new Map<string, StationAcc>();

  for (const record of records) {
    const state = text(record.state);
    const city = text(record.city);
    const name = text(record.station);
    if (!state || !city || !name) continue;

    const pollutantId =
      typeof record.pollutant_id === "string"
        ? normalizePollutant(record.pollutant_id)
        : null;

    const key = `${state}\u0000${city}\u0000${name}`;
    let acc = groups.get(key);
    if (!acc) {
      acc = {
        state,
        city,
        name,
        latitude: null,
        longitude: null,
        updatedAt: null,
        updatedMs: Number.NEGATIVE_INFINITY,
        pollutants: new Map(),
      };
      groups.set(key, acc);
    }

    if (acc.latitude == null) acc.latitude = parseCoord(record.latitude);
    if (acc.longitude == null) acc.longitude = parseCoord(record.longitude);

    const published = text(record.last_update);
    const parsed = published ? parseCpcbTimestamp(published) : null;
    if (published && parsed != null && parsed >= acc.updatedMs) {
      acc.updatedMs = parsed;
      acc.updatedAt = published;
    }

    if (!pollutantId) continue;
    const subIndex = parseSubIndex(record.avg_value);
    const at = parsed ?? Number.NEGATIVE_INFINITY;
    const previous = acc.pollutants.get(pollutantId);
    if (!previous || preferReading(previous, { subIndex, at })) {
      acc.pollutants.set(pollutantId, { subIndex, at });
    }
  }

  const drafts = [...groups.values()]
    .filter(
      (acc): acc is StationAcc & { latitude: number; longitude: number } =>
        acc.latitude != null && acc.longitude != null,
    )
    .sort(
      (a, b) =>
        a.state.localeCompare(b.state) ||
        a.city.localeCompare(b.city) ||
        a.name.localeCompare(b.name),
    );

  const stations: StationAqi[] = drafts.map((acc) => {
    const pollutants: PollutantReading[] = [];
    for (const id of POLLUTANTS) {
      const reading = acc.pollutants.get(id);
      if (!reading) continue;
      pollutants.push({ id, subIndex: reading.subIndex });
    }
    const official = officialAqi(pollutants);
    return {
      slug: stationSlug(acc.city, acc.name),
      name: acc.name,
      city: acc.city,
      state: acc.state,
      latitude: acc.latitude,
      longitude: acc.longitude,
      aqi: official?.aqi ?? null,
      band: official ? bandFor(official.aqi) : null,
      prominent: official?.prominent ?? null,
      updatedAt: acc.updatedAt,
      pollutants,
      insufficient: official == null,
    };
  });
  assignUniqueSlugs(stations);

  const cityGroups = new Map<string, StationAqi[]>();
  for (const station of stations) {
    const key = `${station.state}\u0000${station.city}`;
    const list = cityGroups.get(key);
    if (list) list.push(station);
    else cityGroups.set(key, [station]);
  }

  const cities: CityAqi[] = [...cityGroups.values()].map((cityStations) => {
    const { city, state } = cityStations[0];
    const reporting = cityStations.filter(
      (station) => station.aqi != null,
    );
    const aqi =
      reporting.length === 0
        ? null
        : Math.round(
            reporting.reduce((sum, station) => sum + (station.aqi ?? 0), 0) /
              reporting.length,
          );
    return {
      slug: citySlug(city, state),
      city,
      state,
      aqi,
      band: bandFor(aqi),
      prominent: prominentPollutant(cityStations),
      stationsReporting: reporting.length,
      stationsTotal: cityStations.length,
      updatedAt: latestUpdate(cityStations),
    };
  });
  cities.sort(compareCities);
  assignUniqueSlugs(cities);

  return { stations, cities };
}

function officialAqi(pollutants: readonly PollutantReading[]): {
  aqi: number;
  prominent: PollutantId;
} | null {
  const numeric = pollutants.filter(
    (reading): reading is PollutantReading & { subIndex: number } =>
      reading.subIndex != null,
  );
  const hasParticulate = numeric.some(
    (reading) => reading.id === "PM2.5" || reading.id === "PM10",
  );
  if (numeric.length < 3 || !hasParticulate) return null;

  let best = numeric[0];
  for (const reading of numeric.slice(1)) {
    if (
      reading.subIndex > best.subIndex ||
      (reading.subIndex === best.subIndex &&
        rank(reading.id) < rank(best.id))
    ) {
      best = reading;
    }
  }
  return { aqi: best.subIndex, prominent: best.id };
}

function prominentPollutant(stations: readonly StationAqi[]): PollutantId | null {
  const reporting = stations.filter((station) => station.aqi != null);
  const counts = new Map<PollutantId, number>();
  for (const station of reporting) {
    if (!station.prominent) continue;
    counts.set(station.prominent, (counts.get(station.prominent) ?? 0) + 1);
  }
  if (counts.size === 0) return null;

  let top = 0;
  for (const count of counts.values()) top = Math.max(top, count);
  const tied = [...counts.keys()].filter((id) => counts.get(id) === top);
  if (tied.length === 1) return tied[0];

  let winner = tied[0];
  let winnerMean = meanSubIndex(reporting, winner);
  for (const id of tied.slice(1)) {
    const mean = meanSubIndex(reporting, id);
    if (
      mean > winnerMean ||
      (mean === winnerMean && rank(id) < rank(winner))
    ) {
      winner = id;
      winnerMean = mean;
    }
  }
  return winner;
}

function meanSubIndex(stations: readonly StationAqi[], id: PollutantId): number {
  const values: number[] = [];
  for (const station of stations) {
    const reading = station.pollutants.find((item) => item.id === id);
    if (reading?.subIndex != null) values.push(reading.subIndex);
  }
  if (values.length === 0) return Number.NEGATIVE_INFINITY;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function latestUpdate(stations: readonly StationAqi[]): string | null {
  let best: string | null = null;
  let bestMs = Number.NEGATIVE_INFINITY;
  for (const station of stations) {
    if (!station.updatedAt) continue;
    const ms = parseCpcbTimestamp(station.updatedAt);
    if (ms == null || ms < bestMs) continue;
    bestMs = ms;
    best = station.updatedAt;
  }
  return best;
}

function preferReading(
  previous: PollutantAcc,
  next: PollutantAcc,
): boolean {
  if (next.at > previous.at) return true;
  if (next.at < previous.at) return false;
  if (previous.subIndex == null && next.subIndex != null) return true;
  if (previous.subIndex != null && next.subIndex == null) return false;
  return true;
}

function assignUniqueSlugs(items: { slug: string }[]): void {
  const seen = new Map<string, number>();
  for (const item of items) {
    const count = seen.get(item.slug) ?? 0;
    seen.set(item.slug, count + 1);
    if (count > 0) item.slug = `${item.slug}-${count + 1}`;
  }
}

function stationSlug(city: string, name: string): string {
  return `${slugify(city) || "city"}-${slugify(name) || "station"}`;
}

function citySlug(city: string, state: string): string {
  return `${slugify(city) || "city"}-${slugify(state) || "state"}`;
}

function rank(id: PollutantId): number {
  return POLLUTANT_RANK.get(id) ?? POLLUTANTS.length;
}

function compareCities(a: CityAqi, b: CityAqi): number {
  if (a.aqi == null && b.aqi == null) {
    return a.city.localeCompare(b.city) || a.state.localeCompare(b.state);
  }
  if (a.aqi == null) return 1;
  if (b.aqi == null) return -1;
  if (a.aqi !== b.aqi) return b.aqi - a.aqi;
  return a.city.localeCompare(b.city) || a.state.localeCompare(b.state);
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseCoord(value: unknown): number | null {
  return parseFinite(value);
}

function parseSubIndex(value: unknown): number | null {
  const parsed = parseFinite(value);
  if (parsed == null) return null;
  return clampIndex(parsed);
}

function parseFinite(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toUpperCase() === "NA") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}
