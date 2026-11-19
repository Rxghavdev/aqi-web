import { errorText, logWarn } from "../log.ts";
import { LruCache } from "../lru.ts";
import { shared } from "../shared.ts";
import { SingleFlight } from "../single-flight.ts";

const TTL_MS = 15 * 60 * 1000;
/** After a failed fetch, do not ask again for this long. */
const FAILURE_TTL_MS = 60 * 1000;
const TIMEOUT_MS = 3_500;
const MAX_ENTRIES = 500;
/** Upstream calls allowed at once; more are skipped, not queued. */
const MAX_IN_FLIGHT = 8;
const ENDPOINT = "https://api.open-meteo.com/v1/forecast";

export type Weather = {
  temperatureC: number | null;
  humidity: number | null;
  windKph: number | null;
  uvIndex: number | null;
  label: string;
  code: number | null;
};

/** Bounded: keys come from visitor-supplied coordinates, rounded to ~1 km. */
const cache = shared("weather.cache", () => new LruCache<string, Weather>({ max: MAX_ENTRIES, ttlMs: TTL_MS }));
const failures = shared("weather.failures", () => new LruCache<string, true>({ max: MAX_ENTRIES, ttlMs: FAILURE_TTL_MS }));
const flights = shared("weather.flights", () => new SingleFlight<string, Weather | null>());

function cacheKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
}

/** From memory only. Never touches the network. */
export function cachedWeather(latitude: number, longitude: number): Weather | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return cache.peek(cacheKey(latitude, longitude)) ?? null;
}

/**
 * Current conditions at a point, cached briefly in memory.
 * Never throws: a weather outage must not affect the AQI reading.
 * Identical concurrent requests share one upstream call.
 */
export async function currentWeather(
  latitude: number,
  longitude: number,
): Promise<Weather | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const key = cacheKey(latitude, longitude);
  const hit = cache.get(key);
  if (hit) return hit;
  if (failures.has(key)) return null;
  if (!flights.has(key) && flights.size >= MAX_IN_FLIGHT) return null;

  try {
    return await flights.run(key, async () => {
      const weather = await fetchWeather(latitude, longitude);
      if (weather) cache.set(key, weather);
      else failures.set(key, true);
      return weather;
    });
  } catch {
    return null;
  }
}

async function fetchWeather(
  latitude: number,
  longitude: number,
): Promise<Weather | null> {
  try {
    const url = new URL(ENDPOINT);
    url.searchParams.set("latitude", latitude.toFixed(2));
    url.searchParams.set("longitude", longitude.toFixed(2));
    url.searchParams.set(
      "current",
      "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
    );
    url.searchParams.set("daily", "uv_index_max");
    url.searchParams.set("timezone", "Asia/Kolkata");
    url.searchParams.set("forecast_days", "1");

    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      await response.body?.cancel();
      logWarn("upstream.failed", { source: "open-meteo-weather", status: response.status });
      return null;
    }
    const body: unknown = await response.json();
    const weather = parseWeather(body);
    if (!weather) {
      logWarn("upstream.failed", { source: "open-meteo-weather", reason: "unusable body" });
    }
    return weather;
  } catch (error) {
    logWarn("upstream.failed", { source: "open-meteo-weather", error: errorText(error) });
    return null;
  }
}

function parseWeather(body: unknown): Weather | null {
  if (!body || typeof body !== "object") return null;
  const record = body as {
    current?: Record<string, unknown>;
    daily?: { uv_index_max?: unknown[] };
  };
  const current = record.current;
  if (!current || typeof current !== "object") return null;

  const code = number(current.weather_code);
  const weather: Weather = {
    temperatureC: number(current.temperature_2m),
    humidity: number(current.relative_humidity_2m),
    windKph: number(current.wind_speed_10m),
    uvIndex: number(record.daily?.uv_index_max?.[0]),
    label: conditionLabel(code),
    code,
  };
  if (
    weather.temperatureC == null &&
    weather.humidity == null &&
    weather.windKph == null
  ) {
    return null;
  }
  return weather;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** WMO weather codes, in plain words. */
function conditionLabel(code: number | null): string {
  if (code == null) return "Conditions unavailable";
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mostly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code === 85 || code === 86) return "Snow showers";
  if (code >= 95) return "Thunderstorm";
  return "Hazy";
}
