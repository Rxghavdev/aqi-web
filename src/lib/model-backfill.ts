import {
  openHistory,
  rangeStart,
  recordModelPoints,
  type TrendKind,
  type TrendPoint,
} from "./history.ts";
import { errorText, logWarn } from "./log.ts";
import { LruCache } from "./lru.ts";
import { SingleFlight } from "./single-flight.ts";
import { shared } from "./shared.ts";
import { readSnapshot } from "./snapshot.ts";
import { fetchModelTrend } from "./sources/model-trend.ts";

/**
 * Detached loader for the optional modelled trend line.
 *
 * A trend request answers from SQLite immediately and calls `schedule`; the
 * Open-Meteo fetch then runs on its own. Guards, all in memory and bounded:
 * one run per place at a time, a cap on runs at once, and a cool-down after
 * each attempt so a place that fails (or does not exist) is not retried on
 * every request.
 */

export type Spot = { latitude: number; longitude: number };

export type BackfillDeps = {
  locate(kind: TrendKind, slug: string): Promise<Spot | null>;
  fetchPoints(spot: Spot, start: string, end: string): Promise<TrendPoint[]>;
  save(kind: TrendKind, slug: string, points: TrendPoint[], today: string): void;
  maxConcurrent?: number;
  /** Quiet period after an attempt for the same place. */
  cooldownMs?: number;
  maxTracked?: number;
  now?: () => number;
};

export type Backfiller = {
  /** True when work was started; false when skipped (busy, cooling, unknown). */
  schedule(kind: TrendKind, slug: string, today: string): boolean;
  /** Resolves when everything started so far has settled. For tests. */
  idle(): Promise<void>;
};

export function createBackfiller(deps: BackfillDeps): Backfiller {
  const maxConcurrent = deps.maxConcurrent ?? 3;
  const attempted = new LruCache<string, true>({
    max: deps.maxTracked ?? 2_000,
    ttlMs: deps.cooldownMs ?? 10 * 60 * 1000,
    now: deps.now,
  });
  const flights = new SingleFlight<string, void>();

  return {
    schedule(kind, slug, today) {
      const key = `${kind}:${slug}`;
      if (attempted.has(key) || flights.has(key)) return false;
      if (flights.size >= maxConcurrent) return false;
      attempted.set(key, true);
      void flights
        .run(key, async () => {
          const spot = await deps.locate(kind, slug);
          if (!spot) return;
          const points = await deps.fetchPoints(spot, rangeStart("6m", today), today);
          if (points.length > 0) deps.save(kind, slug, points, today);
        })
        .catch((error: unknown) => {
          // A missing model line must not affect the official series.
          logWarn("trend.backfill_failed", { kind, slug, error: errorText(error) });
        });
      return true;
    },
    async idle() {
      while (flights.size > 0) await new Promise((resolve) => setTimeout(resolve, 5));
    },
  };
}

async function locate(kind: TrendKind, slug: string): Promise<Spot | null> {
  const { snapshot } = await readSnapshot();
  if (!snapshot) return null;
  if (kind === "station") {
    const station = snapshot.stations.find((item) => item.slug === slug);
    return station ? { latitude: station.latitude, longitude: station.longitude } : null;
  }
  const city = snapshot.cities.find((entry) => entry.slug === slug);
  if (!city) return null;
  const stations = snapshot.stations.filter(
    (item) => item.city === city.city && item.state === city.state,
  );
  if (stations.length === 0) return null;
  const latitude = stations.reduce((sum, item) => sum + item.latitude, 0) / stations.length;
  const longitude = stations.reduce((sum, item) => sum + item.longitude, 0) / stations.length;
  return { latitude, longitude };
}

export const modelBackfill = shared("trend.backfill", () => createBackfiller({
  locate,
  fetchPoints: (spot, start, end) =>
    fetchModelTrend(spot.latitude, spot.longitude, start, end),
  save: (kind, slug, points, today) =>
    recordModelPoints(openHistory(), kind, slug, points, today),
}));
