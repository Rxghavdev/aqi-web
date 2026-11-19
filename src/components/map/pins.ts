import { cityPath, stationPath } from "@/components/reading/text";
import type { Band, StationAqi } from "@/lib/types";

export type MapPin = {
  slug: string;
  name: string;
  place: string;
  lat: number;
  lon: number;
  aqi: number | null;
  band: Band | null;
  href: string;
  /** Which trend series the pin card reads: a station, or a city average. */
  kind: "station" | "city";
  /** CPCB publish stamp ("DD-MM-YYYY HH:mm:ss"), when the source carries one. */
  updatedAt: string | null;
};

const BANDS = new Set<Band>([
  "Good",
  "Satisfactory",
  "Moderate",
  "Poor",
  "Very Poor",
  "Severe",
]);

export function stationPins(stations: readonly StationAqi[]): MapPin[] {
  const pins: MapPin[] = [];
  for (const station of stations) {
    if (!usable(station.latitude, station.longitude)) continue;
    const aqi =
      station.aqi != null && Number.isFinite(station.aqi) ? station.aqi : null;
    pins.push({
      slug: station.slug,
      name: station.name,
      place: `${station.city}, ${station.state}`,
      lat: station.latitude,
      lon: station.longitude,
      aqi,
      band: aqi == null ? null : station.band,
      href: stationPath(station.slug),
      kind: "station",
      updatedAt: station.updatedAt ?? null,
    });
  }
  return pins;
}

export function cityPins(rows: unknown): MapPin[] {
  if (!Array.isArray(rows)) return [];
  const pins: MapPin[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    if (typeof item.slug !== "string" || typeof item.name !== "string") continue;
    if (typeof item.lat !== "number" || typeof item.lon !== "number") continue;
    if (!usable(item.lat, item.lon)) continue;
    const aqi = typeof item.aqi === "number" && Number.isFinite(item.aqi) ? item.aqi : null;
    const band = isBand(item.band) ? item.band : null;
    pins.push({
      slug: item.slug,
      name: item.name,
      place: typeof item.place === "string" ? item.place : "",
      lat: item.lat,
      lon: item.lon,
      aqi,
      band: aqi == null ? null : band,
      href: cityPath(item.slug),
      kind: "city",
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : null,
    });
  }
  return pins;
}

export function safeMapHref(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!/^\/(city|station)\/[a-z0-9%-]{1,160}$/.test(value)) return null;
  return value;
}

function usable(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180 &&
    !(lat === 0 && lon === 0)
  );
}

function isBand(value: unknown): value is Band {
  return typeof value === "string" && BANDS.has(value as Band);
}
