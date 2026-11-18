import { indiaAqiFromConcentration } from "../aqi.ts";
import { logWarn } from "../log.ts";
import { LruCache } from "../lru.ts";
import { shared } from "../shared.ts";
import { SingleFlight, withDeadline } from "../single-flight.ts";

const MODEL_TTL_MS = 30 * 60 * 1000;
/** After a failed fetch, do not ask again for this long. */
const FAILURE_TTL_MS = 60 * 1000;
const TIMEOUT_MS = 4_000;
/** How long a page or API call waits for the optional hourly estimate. */
export const SPIKE_DEADLINE_MS = 400;
const MAX_ENTRIES = 300;
/** Upstream calls allowed at once; more are skipped, not queued. */
const MAX_IN_FLIGHT = 6;

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

/** Bounded: keys come from visitor-supplied coordinates, rounded to ~1 km. */
const cache = shared("openmeteo.cache", () => new LruCache<string, Hourly>({ max: MAX_ENTRIES, ttlMs: MODEL_TTL_MS }));
const failures = shared("openmeteo.failures", () => new LruCache<string, true>({ max: MAX_ENTRIES, ttlMs: FAILURE_TTL_MS }));
const flights = shared("openmeteo.flights", () => new SingleFlight<string, Hourly | null>());
/** Index into ENDPOINTS that last answered, so a dead host is not tried first. */
let preferred = 0;

function cacheKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
}

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

/** From memory only. Never touches the network. */
export function cachedHourlyModelAqi(
  latitude: number,
  longitude: number,
): HourlyModel | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const hit = cache.peek(cacheKey(latitude, longitude));
  return hit ? { ok: true, hourlyAqi: indexAtLatestHour(hit) } : null;
}

/**
 * The hourly estimate if it is cached or arrives within `deadlineMs`.
 * Otherwise `{ ok: false }` right away: the request carries on in the
 * background and fills the cache, so the next visit has it. A slow model must
 * never hold up the official reading, so this is the accessor pages should use.
 */
export async function hourlyModelAqiWithin(
  latitude: number,
  longitude: number,
  deadlineMs: number = SPIKE_DEADLINE_MS,
): Promise<HourlyModel> {
  const cached = cachedHourlyModelAqi(latitude, longitude);
  if (cached) return cached;
  return withDeadline(hourlyModelAqi(latitude, longitude), deadlineMs, {
    ok: false,
  } as HourlyModel);
}

async function loadHourly(
  latitude: number,
  longitude: number,
): Promise<Hourly | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const key = cacheKey(latitude, longitude);
  const hit = cache.get(key);
  if (hit) return hit;
  if (failures.has(key)) return null;
  if (!flights.has(key) && flights.size >= MAX_IN_FLIGHT) return null;

  return flights.run(key, async () => {
    const hourly = await fetchHourly(
      Number(latitude.toFixed(2)),
      Number(longitude.toFixed(2)),
    );
    if (hourly) cache.set(key, hourly);
    else failures.set(key, true);
    return hourly;
  });
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

  for (let attempt = 0; attempt < ENDPOINTS.length; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining < 200) return null;
    const isLast = attempt === ENDPOINTS.length - 1;
    const budget = isLast ? remaining : Math.min(remaining, 1_500);
    const index = (preferred + attempt) % ENDPOINTS.length;
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
        logWarn("upstream.failed", { source: "open-meteo-aq", status: response.status });
        return null;
      }
      const body: unknown = await response.json();
      const hourly = parseHourly(body);
      if (hourly) {
        preferred = index;
        return hourly;
      }
      return null;
    } catch {
      // The documented host often 404s or stalls. Try the next host with
      // whatever is left of the 4 second budget.
    }
  }
  logWarn("upstream.failed", { source: "open-meteo-aq", reason: "no host answered" });
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
