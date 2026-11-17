import { indiaAqiFromConcentration } from "../aqi.ts";

const MODEL_TTL_MS = 30 * 60 * 1000;
const TIMEOUT_MS = 4_000;

/**
 * api.open-meteo.com/v1/air-quality currently 404s.
 * The licensed air-quality API is served from air-quality-api.open-meteo.com
 * with the same query. Try the documented host first, then the live one.
 */
const ENDPOINTS = [
  "https://api.open-meteo.com/v1/air-quality",
  "https://air-quality-api.open-meteo.com/v1/air-quality",
];

type Hourly = {
  time: string[];
  pm2_5: unknown[];
  pm10: unknown[];
};

type CacheEntry = {
  at: number;
  hourly: Hourly;
};

const cache = new Map<string, CacheEntry>();

export type HourlyModel =
  | { ok: true; hourlyAqi: number | null }
  | { ok: false };

/** Latest hourly India-scale index at this point. Never throws. */
export async function hourlyModelAqi(
  latitude: number,
  longitude: number,
): Promise<HourlyModel> {
  try {
    const hourly = await loadHourly(latitude, longitude);
    if (!hourly) return { ok: false };
    return { ok: true, hourlyAqi: indexAtLatestHour(hourly) };
  } catch {
    return { ok: false };
  }
}

async function loadHourly(
  latitude: number,
  longitude: number,
): Promise<Hourly | null> {
  const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < MODEL_TTL_MS) return hit.hourly;

  const hourly = await fetchHourly(
    Number(latitude.toFixed(2)),
    Number(longitude.toFixed(2)),
  );
  if (!hourly) return null;
  cache.set(key, { at: Date.now(), hourly });
  return hourly;
}

async function fetchHourly(
  latitude: number,
  longitude: number,
): Promise<Hourly | null> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    hourly: "pm2_5,pm10",
    timezone: "Asia/Kolkata",
    forecast_days: "1",
  });
  const deadline = Date.now() + TIMEOUT_MS;

  for (let index = 0; index < ENDPOINTS.length; index += 1) {
    const remaining = deadline - Date.now();
    if (remaining < 200) return null;
    const isLast = index === ENDPOINTS.length - 1;
    const budget = isLast ? remaining : Math.min(remaining, 1_500);
    const endpoint = ENDPOINTS[index];
    try {
      const response = await fetch(`${endpoint}?${params}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(budget),
      });
      if (response.status === 404) {
        await response.body?.cancel();
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        return null;
      }
      const body: unknown = await response.json();
      const hourly = parseHourly(body);
      if (hourly) return hourly;
      return null;
    } catch {
      // The documented host often 404s or stalls. Try the next host with
      // whatever is left of the 4 second budget.
    }
  }
  return null;
}

function parseHourly(body: unknown): Hourly | null {
  if (!body || typeof body !== "object") return null;
  const hourly = (body as { hourly?: unknown }).hourly;
  if (!hourly || typeof hourly !== "object") return null;
  const record = hourly as {
    time?: unknown;
    pm2_5?: unknown;
    pm10?: unknown;
  };
  if (!Array.isArray(record.time)) return null;
  return {
    time: record.time.map((value) => String(value)),
    pm2_5: Array.isArray(record.pm2_5) ? record.pm2_5 : [],
    pm10: Array.isArray(record.pm10) ? record.pm10 : [],
  };
}

function indexAtLatestHour(hourly: Hourly, now = new Date()): number | null {
  const nowKey = kolkataHourKey(now);
  let bestTime = "";
  let bestIndex = -1;
  for (let index = 0; index < hourly.time.length; index += 1) {
    const time = hourly.time[index]?.slice(0, 16) ?? "";
    if (!time || time > nowKey || time < bestTime) continue;
    bestTime = time;
    bestIndex = index;
  }
  if (bestIndex < 0) return null;

  const pm25 = concentrationIndex("PM2.5", hourly.pm2_5[bestIndex]);
  const pm10 = concentrationIndex("PM10", hourly.pm10[bestIndex]);
  const values = [pm25, pm10].filter((value): value is number => value != null);
  if (values.length === 0) return null;
  return Math.max(...values);
}

function concentrationIndex(
  pollutant: "PM2.5" | "PM10",
  value: unknown,
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return indiaAqiFromConcentration(pollutant, value);
}

function kolkataHourKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}T${read("hour")}:${read("minute")}`;
}
