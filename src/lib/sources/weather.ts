const TTL_MS = 15 * 60 * 1000;
const TIMEOUT_MS = 3_500;
const ENDPOINT = "https://api.open-meteo.com/v1/forecast";

export type Weather = {
  temperatureC: number | null;
  humidity: number | null;
  windKph: number | null;
  uvIndex: number | null;
  label: string;
  code: number | null;
};

type Entry = { at: number; weather: Weather };

const cache = new Map<string, Entry>();

/**
 * Current conditions at a point, cached briefly in memory.
 * Never throws: a weather outage must not affect the AQI reading.
 */
export async function currentWeather(
  latitude: number,
  longitude: number,
): Promise<Weather | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.weather;

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
      return null;
    }
    const body: unknown = await response.json();
    const weather = parseWeather(body);
    if (!weather) return null;
    cache.set(key, { at: Date.now(), weather });
    return weather;
  } catch {
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
