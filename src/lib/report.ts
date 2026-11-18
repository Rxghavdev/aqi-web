import { slugify } from "./aggregate.ts";
import { haversineKm, roundKm } from "./geo.ts";
import { kickRefresh } from "./refresh.ts";
import { hourlyModelAqi } from "./sources/open-meteo.ts";
import { readSnapshot, type SnapshotFile } from "./snapshot.ts";
import type {
  CityAqi,
  PlaceReport,
  SearchHit,
  SnapshotMeta,
  Spike,
  StationAqi,
} from "./types.ts";

export type MapCityPoint = {
  slug: string;
  name: string;
  place: string;
  lat: number;
  lon: number;
  aqi: number | null;
  band: CityAqi["band"];
};

/**
 * Public data API for the UI.
 * These functions read the CPCB snapshot on disk. They do not download it.
 */

export async function getSnapshotMeta(): Promise<SnapshotMeta> {
  const { snapshot, stale } = await readSnapshot();
  if (!snapshot) {
    return {
      snapshotAt: null,
      rowCount: 0,
      stationCount: 0,
      cityCount: 0,
      stale: true,
    };
  }
  return {
    snapshotAt: snapshot.snapshotAt,
    rowCount: snapshot.rowCount,
    stationCount: snapshot.stations.length,
    cityCount: snapshot.cities.length,
    stale,
  };
}

export async function listCities(): Promise<CityAqi[]> {
  kickRefresh();
  const { snapshot } = await readSnapshot();
  if (!snapshot) return [];
  return snapshot.cities.slice().sort(compareCities);
}

/** Every station, for the sitemap. */
export async function listStations(): Promise<StationAqi[]> {
  const { snapshot } = await readSnapshot();
  if (!snapshot) return [];
  return snapshot.stations;
}

/** City averages placed at the mean of their station coordinates. */
export async function listMapCities(): Promise<MapCityPoint[]> {
  kickRefresh();
  const { snapshot } = await readSnapshot();
  if (!snapshot) return [];
  const grouped = new Map<string, { lat: number; lon: number; count: number }>();
  for (const station of snapshot.stations) {
    if (!usableCoord(station.latitude, station.longitude)) continue;
    const key = `${station.city}\0${station.state}`;
    const current = grouped.get(key);
    if (current) {
      current.lat += station.latitude;
      current.lon += station.longitude;
      current.count += 1;
    } else {
      grouped.set(key, {
        lat: station.latitude,
        lon: station.longitude,
        count: 1,
      });
    }
  }
  const points: MapCityPoint[] = [];
  for (const city of snapshot.cities) {
    const group = grouped.get(`${city.city}\0${city.state}`);
    if (!group || group.count === 0) continue;
    points.push({
      slug: city.slug,
      name: city.city,
      place: city.state,
      lat: roundCoord(group.lat / group.count),
      lon: roundCoord(group.lon / group.count),
      aqi: city.aqi,
      band: city.band,
    });
  }
  return points;
}

export async function getCity(
  slug: string,
): Promise<{ city: CityAqi; stations: StationAqi[]; nearby: StationAqi[] } | null> {
  kickRefresh();
  const { snapshot } = await readSnapshot();
  if (!snapshot) return null;
  const city = snapshot.cities.find((item) => item.slug === slug);
  if (!city) return null;
  const stations = stationsIn(snapshot, city).sort(compareStations);
  const point = centroid(stations);
  return {
    city,
    stations,
    nearby: point ? stationsAround(snapshot, point.latitude, point.longitude, 60) : stations,
  };
}

export async function getStation(slug: string): Promise<StationAqi | null> {
  const page = await getStationPage(slug);
  return page?.station ?? null;
}

export async function getStationPage(
  slug: string,
): Promise<{
  station: StationAqi;
  city: CityAqi | null;
  nearby: StationAqi[];
} | null> {
  kickRefresh();
  const { snapshot } = await readSnapshot();
  if (!snapshot) return null;
  const station = snapshot.stations.find((item) => item.slug === slug);
  if (!station) return null;
  const city =
    snapshot.cities.find(
      (item) => item.city === station.city && item.state === station.state,
    ) ?? null;
  return {
    station,
    city,
    nearby: stationsAround(snapshot, station.latitude, station.longitude, 60),
  };
}

export async function getPlace(input: {
  query?: string;
  lat?: number;
  lon?: number;
}): Promise<PlaceReport | null> {
  kickRefresh();
  const { snapshot } = await readSnapshot();
  if (!snapshot || snapshot.stations.length === 0) return null;

  const query = (input.query?.trim() ?? "").slice(0, 80);
  const hasPoint =
    typeof input.lat === "number" &&
    typeof input.lon === "number" &&
    input.lat >= -90 &&
    input.lat <= 90 &&
    input.lon >= -180 &&
    input.lon <= 180;

  if (hasPoint) {
    return placeFromPoint(snapshot, input.lat as number, input.lon as number, query);
  }
  if (!query) return null;
  return placeFromQuery(snapshot, query);
}

export async function searchPlaces(query: string): Promise<SearchHit[]> {
  const trimmed = query.trim().slice(0, 80);
  if (!trimmed) return [];
  const { snapshot } = await readSnapshot();
  if (!snapshot) return [];

  const cities = snapshot.cities
    .map((city) => ({
      city,
      score: matchScore(trimmed, [city.city, city.slug, `${city.city}, ${city.state}`]),
    }))
    .filter((item): item is { city: CityAqi; score: number } => item.score != null)
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return compareCities(a.city, b.city);
    })
    .slice(0, 8)
    .map((item) => ({
      kind: "city" as const,
      slug: item.city.slug,
      label: item.city.city,
      detail: item.city.state,
      aqi: item.city.aqi,
      band: item.city.band,
    }));

  const stations = snapshot.stations
    .map((station) => ({
      station,
      score: matchScore(trimmed, [
        station.name,
        station.slug,
        `${station.name}, ${station.city}`,
      ]),
    }))
    .filter(
      (item): item is { station: StationAqi; score: number } => item.score != null,
    )
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return compareStations(a.station, b.station);
    })
    .slice(0, 8)
    .map((item) => ({
      kind: "station" as const,
      slug: item.station.slug,
      label: item.station.name,
      detail: `${item.station.city}, ${item.station.state}`,
      aqi: item.station.aqi,
      band: item.station.band,
    }));

  return [...cities, ...stations];
}

async function placeFromPoint(
  snapshot: SnapshotFile,
  lat: number,
  lon: number,
  query: string,
): Promise<PlaceReport> {
  let nearest = snapshot.stations[0];
  let nearestKm = haversineKm(lat, lon, nearest.latitude, nearest.longitude);
  for (const station of snapshot.stations.slice(1)) {
    const km = haversineKm(lat, lon, station.latitude, station.longitude);
    if (km < nearestKm) {
      nearest = station;
      nearestKm = km;
    }
  }
  const city =
    snapshot.cities.find(
      (item) => item.city === nearest.city && item.state === nearest.state,
    ) ?? null;
  const others = stationsIn(snapshot, {
    city: nearest.city,
    state: nearest.state,
  })
    .filter((station) => station.slug !== nearest.slug)
    .sort(compareStations);
  const report: PlaceReport = {
    query: query || `${lat},${lon}`,
    city,
    nearest,
    distanceKm: roundKm(nearestKm),
    stations: [nearest, ...others],
    nearby: stationsAround(snapshot, nearest.latitude, nearest.longitude, 60),
    spike: null,
    snapshotAt: snapshot.snapshotAt,
  };
  report.spike = await spikeFor(report, nearest.latitude, nearest.longitude);
  return report;
}

async function placeFromQuery(
  snapshot: SnapshotFile,
  query: string,
): Promise<PlaceReport | null> {
  const city = matchCity(snapshot.cities, query);
  if (city) {
    const stations = stationsIn(snapshot, city).sort(compareStations);
    const report: PlaceReport = {
      query,
      city,
      nearest: null,
      distanceKm: null,
      stations,
      nearby: stations,
      spike: null,
      snapshotAt: snapshot.snapshotAt,
    };
    const point = centroid(stations);
    if (point) report.spike = await spikeFor(report, point.latitude, point.longitude);
    return report;
  }

  const station = matchStation(snapshot.stations, query);
  if (!station) return null;
  const cityMatch =
    snapshot.cities.find(
      (item) => item.city === station.city && item.state === station.state,
    ) ?? null;
  const others = stationsIn(snapshot, station)
    .filter((item) => item.slug !== station.slug)
    .sort(compareStations);
  const report: PlaceReport = {
    query,
    city: cityMatch,
    nearest: station,
    distanceKm: null,
    stations: [station, ...others],
    nearby: stationsAround(snapshot, station.latitude, station.longitude, 60),
    spike: null,
    snapshotAt: snapshot.snapshotAt,
  };
  report.spike = await spikeFor(report, station.latitude, station.longitude);
  return report;
}

function matchCity(cities: readonly CityAqi[], query: string): CityAqi | null {
  const lowered = query.toLowerCase();
  const slugged = slugify(query);
  const bySlug = cities.find(
    (city) => city.slug === lowered || (slugged !== "" && city.slug === slugged),
  );
  if (bySlug) return bySlug;

  const exact = cities.filter((city) => city.city.toLowerCase() === lowered);
  if (exact.length > 0) return mostStations(exact);

  const starts = cities.filter((city) => city.city.toLowerCase().startsWith(lowered));
  if (starts.length > 0) return mostStations(starts);

  const includes = cities.filter((city) => city.city.toLowerCase().includes(lowered));
  if (includes.length > 0) return mostStations(includes);
  return null;
}

function matchStation(
  stations: readonly StationAqi[],
  query: string,
): StationAqi | null {
  const lowered = query.toLowerCase();
  const slugged = slugify(query);
  const bySlug = stations.find(
    (station) =>
      station.slug === lowered || (slugged !== "" && station.slug === slugged),
  );
  if (bySlug) return bySlug;

  const exact = stations.filter((station) => station.name.toLowerCase() === lowered);
  if (exact.length > 0) return highestAqi(exact);

  const starts = stations.filter((station) =>
    station.name.toLowerCase().startsWith(lowered),
  );
  if (starts.length > 0) return highestAqi(starts);

  const includes = stations.filter((station) =>
    station.name.toLowerCase().includes(lowered),
  );
  if (includes.length > 0) return highestAqi(includes);
  return null;
}

function mostStations(cities: readonly CityAqi[]): CityAqi {
  return cities.slice().sort((a, b) => {
    if (b.stationsTotal !== a.stationsTotal) return b.stationsTotal - a.stationsTotal;
    return compareCities(a, b);
  })[0];
}

function highestAqi(stations: readonly StationAqi[]): StationAqi {
  return stations.slice().sort(compareStations)[0];
}

function stationsIn(
  snapshot: SnapshotFile,
  place: { city: string; state: string },
): StationAqi[] {
  return snapshot.stations.filter(
    (station) => station.city === place.city && station.state === place.state,
  );
}

/**
 * Monitors around a point, nearest first, capped so the map stays readable.
 * A radius in kilometres, not a city boundary: air does not stop at one.
 */
function stationsAround(
  snapshot: SnapshotFile,
  lat: number,
  lon: number,
  radiusKm: number,
): StationAqi[] {
  const found = snapshot.stations
    .map((station) => ({
      station,
      km: haversineKm(lat, lon, station.latitude, station.longitude),
    }))
    .filter((item) => item.km <= radiusKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, 40)
    .map((item) => item.station);
  return found;
}

function usableCoord(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180 &&
    !(lat === 0 && lon === 0)
  );
}

function roundCoord(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function centroid(
  stations: readonly StationAqi[],
): { latitude: number; longitude: number } | null {
  if (stations.length === 0) return null;
  const latitude =
    stations.reduce((sum, station) => sum + station.latitude, 0) / stations.length;
  const longitude =
    stations.reduce((sum, station) => sum + station.longitude, 0) / stations.length;
  return { latitude, longitude };
}

async function spikeFor(
  report: PlaceReport,
  latitude: number,
  longitude: number,
): Promise<Spike | null> {
  const model = await hourlyModelAqi(latitude, longitude);
  if (!model.ok) return null;

  const officialAqi =
    report.nearest?.aqi != null ? report.nearest.aqi : (report.city?.aqi ?? null);
  const hourlyAqi = model.hourlyAqi;
  const hasOfficial = report.city?.aqi != null || report.nearest?.aqi != null;
  const active =
    hasOfficial &&
    hourlyAqi != null &&
    officialAqi != null &&
    hourlyAqi >= officialAqi + 50;

  return {
    active,
    hourlyAqi,
    officialAqi,
    source: "model",
    summary: active
      ? `Hourly model estimate is ${hourlyAqi}. The official CPCB number stays ${officialAqi}, because that is a 24-hour average.`
      : "",
  };
}

function matchScore(query: string, fields: readonly string[]): number | null {
  const lowered = query.trim().toLowerCase();
  if (!lowered) return null;
  let best: number | null = null;
  for (const field of fields) {
    const value = field.toLowerCase();
    let score: number | null = null;
    if (value === lowered) score = 0;
    else if (value.startsWith(lowered)) score = 1;
    else if (value.includes(lowered)) score = 2;
    if (score != null && (best == null || score < best)) best = score;
  }
  return best;
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

function compareStations(a: StationAqi, b: StationAqi): number {
  if (a.aqi == null && b.aqi == null) return a.name.localeCompare(b.name);
  if (a.aqi == null) return 1;
  if (b.aqi == null) return -1;
  if (a.aqi !== b.aqi) return b.aqi - a.aqi;
  return a.name.localeCompare(b.name);
}
