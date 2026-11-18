import { indiaAqiFromConcentration } from "../aqi.ts";
import type { TrendPoint } from "../history.ts";
import { logWarn } from "../log.ts";

const ENDPOINT = "https://air-quality-api.open-meteo.com/v1/air-quality";

/** Daily India-scale index from the CAMS model. Not the CPCB number. */
export async function fetchModelTrend(
  latitude: number,
  longitude: number,
  start: string,
  end: string,
): Promise<TrendPoint[]> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
  const url = new URL(ENDPOINT);
  url.searchParams.set("latitude", latitude.toFixed(3));
  url.searchParams.set("longitude", longitude.toFixed(3));
  url.searchParams.set("hourly", "pm2_5");
  url.searchParams.set("timezone", "Asia/Kolkata");
  url.searchParams.set("start_date", start);
  url.searchParams.set("end_date", end);

  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    logWarn("upstream.failed", { source: "open-meteo-trend", status: response.status });
    return [];
  }
  const body: unknown = await response.json();
  const hourly =
    body && typeof body === "object"
      ? (body as { hourly?: { time?: unknown; pm2_5?: unknown } }).hourly
      : undefined;
  const times = Array.isArray(hourly?.time) ? hourly.time : [];
  const values = Array.isArray(hourly?.pm2_5) ? hourly.pm2_5 : [];
  const buckets = new Map<string, number[]>();
  for (let index = 0; index < times.length; index += 1) {
    const stamp = times[index];
    const raw = values[index];
    if (typeof stamp !== "string" || typeof raw !== "number" || !Number.isFinite(raw)) {
      continue;
    }
    const date = stamp.slice(0, 10);
    const list = buckets.get(date);
    if (list) list.push(raw);
    else buckets.set(date, [raw]);
  }

  const points: TrendPoint[] = [];
  for (const [date, samples] of buckets) {
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    const aqi = indiaAqiFromConcentration("PM2.5", mean);
    if (aqi == null) continue;
    points.push({ date, aqi });
  }
  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}
