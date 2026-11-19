import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { aggregateRecords } from "./aggregate.ts";
import { openHistory, recordOfficial } from "./history.ts";
import { errorText, logError, logInfo, logWarn } from "./log.ts";
import { shared } from "./shared.ts";
import { fetchAllCpcbRecords } from "./sources/cpcb.ts";
import type { CityAqi, StationAqi } from "./types.ts";

const FRESH_MS = 30 * 60 * 1000;

export const SNAPSHOT_PATH = path.join(
  process.cwd(),
  ".cache",
  "cpcb-snapshot.json",
);

export type SnapshotFile = {
  snapshotAt: string;
  stations: StationAqi[];
  cities: CityAqi[];
  rowCount: number;
};

type Memory = {
  snapshot: SnapshotFile;
  mtimeMs: number;
  refreshFailed: boolean;
};

type Loaded = { snapshot: SnapshotFile | null; stale: boolean };

const state = shared("snapshot.state", () => ({
  memory: null as Memory | null,
  inflight: null as Promise<SnapshotFile> | null,
  /** mtime of a file that failed to parse, so it is not re-read on every request. */
  badMtimeMs: null as number | null,
  loading: null as Promise<Loaded> | null,
}));

/* ---------- refresh bookkeeping (in memory, for /api/health and backoff) ---------- */

export type RefreshStatus = {
  /** "none" until this process has tried once. */
  lastResult: "none" | "ok" | "failed";
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastDurationMs: number | null;
  consecutiveFailures: number;
  inFlight: boolean;
  /** Earliest time a visit-triggered refresh may try again, after a failure. */
  retryAfter: string | null;
};

const status = shared("snapshot.status", () => ({
  lastResult: "none" as RefreshStatus["lastResult"],
  lastAttemptAt: null as number | null,
  lastSuccessAt: null as number | null,
  lastError: null as string | null,
  lastDurationMs: null as number | null,
  consecutiveFailures: 0,
  nextAttemptAt: 0,
}));

const BACKOFF_BASE_MS = 5 * 60 * 1000;
const BACKOFF_MAX_MS = 30 * 60 * 1000;

/** Wait after the nth consecutive failure: 5, 10, 20, then 30 minutes. */
export function backoffMs(failures: number): number {
  if (failures < 1) return 0;
  return Math.min(BACKOFF_BASE_MS * 2 ** (failures - 1), BACKOFF_MAX_MS);
}

/** False while a failed refresh is cooling down or one is already running. */
export function refreshAllowed(now = Date.now()): boolean {
  return !state.inflight && now >= status.nextAttemptAt;
}

export function getRefreshStatus(): RefreshStatus {
  const iso = (value: number | null) =>
    value == null ? null : new Date(value).toISOString();
  return {
    lastResult: status.lastResult,
    lastAttemptAt: iso(status.lastAttemptAt),
    lastSuccessAt: iso(status.lastSuccessAt),
    lastError: status.lastError,
    lastDurationMs: status.lastDurationMs,
    consecutiveFailures: status.consecutiveFailures,
    inFlight: state.inflight != null,
    retryAfter: Date.now() < status.nextAttemptAt ? iso(status.nextAttemptAt) : null,
  };
}

/* ---------- reading ---------- */

/**
 * Read the on-disk snapshot. Never downloads, never throws.
 * A missing cache returns null quickly. An unreadable or malformed file keeps
 * serving the last good copy from memory, flagged stale.
 */
export async function readSnapshot(): Promise<{
  snapshot: SnapshotFile | null;
  stale: boolean;
}> {
  try {
    const info = await stat(SNAPSHOT_PATH);
    if (state.memory && state.memory.mtimeMs === info.mtimeMs) {
      return { snapshot: state.memory.snapshot, stale: isStale(state.memory) };
    }
    if (state.badMtimeMs === info.mtimeMs) {
      return { snapshot: state.memory?.snapshot ?? null, stale: true };
    }
    // One parse at a time: a burst of first requests shares the same read.
    if (!state.loading) {
      state.loading = loadFromDisk(info.mtimeMs).finally(() => {
        state.loading = null;
      });
    }
    return await state.loading;
  } catch (error) {
    if (!isEnoent(error)) {
      logWarn("snapshot.read_failed", { error: errorText(error) });
    }
    return {
      snapshot: isEnoent(error) ? null : (state.memory?.snapshot ?? null),
      stale: true,
    };
  }
}

async function loadFromDisk(
  mtimeMs: number,
): Promise<{ snapshot: SnapshotFile | null; stale: boolean }> {
  const text = await readFile(SNAPSHOT_PATH, "utf8");
  const snapshot = parseSnapshot(text);
  if (!snapshot) {
    state.badMtimeMs = mtimeMs;
    logError("snapshot.corrupt", { path: path.basename(SNAPSHOT_PATH), bytes: text.length });
    return { snapshot: state.memory?.snapshot ?? null, stale: true };
  }
  state.badMtimeMs = null;
  state.memory = { snapshot, mtimeMs, refreshFailed: false };
  return { snapshot, stale: isStale(state.memory) };
}

/**
 * Download a new snapshot. One refresh runs at a time.
 * Readers of `readSnapshot` keep the previous file while this is in flight.
 * If the download throws and an older file is already loaded, it stays
 * available with stale set.
 */
export function refreshSnapshot(force = false): Promise<SnapshotFile> {
  if (state.inflight) return state.inflight;
  state.inflight = doRefresh(force).finally(() => {
    state.inflight = null;
  });
  return state.inflight;
}

/**
 * A feed that suddenly lists far fewer stations than the copy on disk is a
 * partial download, not a real change. Keep the older, fuller snapshot.
 */
export function looksPartial(
  previous: { stations: readonly unknown[] } | null,
  next: { stations: readonly unknown[] },
): boolean {
  if (!previous || previous.stations.length < 50) return false;
  return next.stations.length < previous.stations.length * 0.5;
}

async function doRefresh(force: boolean): Promise<SnapshotFile> {
  const current = await readSnapshot();
  if (!force && current.snapshot && !current.stale) return current.snapshot;

  const startedAt = Date.now();
  status.lastAttemptAt = startedAt;
  try {
    const records = await fetchAllCpcbRecords();
    const { stations, cities } = aggregateRecords(records);
    // A 200 with no usable rows is a bad feed, not a real reading. Writing it
    // would blank every page and mark the snapshot fresh, so the refresh would
    // not retry. Rows can exist and still carry no index (every value "NA"),
    // so require at least one station with a published number.
    const reporting = stations.filter((station) => station.aqi != null).length;
    if (records.length === 0 || stations.length === 0 || reporting === 0) {
      throw new Error(
        `CPCB returned no usable readings (${records.length} rows, ${stations.length} stations, ${reporting} reporting)`,
      );
    }
    if (looksPartial(current.snapshot, { stations })) {
      throw new Error(
        `CPCB returned ${stations.length} stations against ${current.snapshot?.stations.length ?? 0} on disk; keeping the fuller snapshot`,
      );
    }
    const snapshot: SnapshotFile = {
      snapshotAt: new Date().toISOString(),
      stations,
      cities,
      rowCount: records.length,
    };
    await writeSnapshot(snapshot);

    let historyRows = 0;
    try {
      historyRows = recordOfficial(openHistory(), snapshot);
    } catch (error) {
      logWarn("history.write_failed", { error: errorText(error) });
    }

    status.lastResult = "ok";
    status.lastSuccessAt = Date.now();
    status.lastError = null;
    status.lastDurationMs = Date.now() - startedAt;
    status.consecutiveFailures = 0;
    status.nextAttemptAt = 0;
    logInfo("refresh.ok", {
      stations: stations.length,
      cities: cities.length,
      rows: records.length,
      historyRows,
      ms: status.lastDurationMs,
    });
    return snapshot;
  } catch (error) {
    if (state.memory) state.memory.refreshFailed = true;
    status.lastResult = "failed";
    status.lastError = errorText(error);
    status.lastDurationMs = Date.now() - startedAt;
    status.consecutiveFailures += 1;
    status.nextAttemptAt = Date.now() + backoffMs(status.consecutiveFailures);
    logError("refresh.failed", {
      error: status.lastError,
      failures: status.consecutiveFailures,
      keptStale: state.memory != null,
      ms: status.lastDurationMs,
    });
    throw error;
  }
}

async function writeSnapshot(snapshot: SnapshotFile): Promise<void> {
  await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
  // A per-process temp name: `npm run sync` and the web server may both write.
  const tmp = `${SNAPSHOT_PATH}.${process.pid}.tmp`;
  try {
    await writeFile(tmp, JSON.stringify(snapshot));
    await rename(tmp, SNAPSHOT_PATH);
  } catch (error) {
    await rm(tmp, { force: true }).catch(() => undefined);
    throw error;
  }
  const info = await stat(SNAPSHOT_PATH);
  state.badMtimeMs = null;
  state.memory = {
    snapshot,
    mtimeMs: info.mtimeMs,
    refreshFailed: false,
  };
}

function isStale(entry: Memory): boolean {
  if (entry.refreshFailed) return true;
  const at = Date.parse(entry.snapshot.snapshotAt);
  if (!Number.isFinite(at)) return true;
  return Date.now() - at > FRESH_MS;
}

/* ---------- validation ---------- */

const isText = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;
const isNum = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const numOrNull = (value: unknown): number | null => (isNum(value) ? value : null);

function cleanStation(value: unknown): StationAqi | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<StationAqi>;
  if (!isText(item.slug) || !isText(item.name)) return null;
  if (typeof item.city !== "string" || typeof item.state !== "string") return null;
  if (!isNum(item.latitude) || !isNum(item.longitude)) return null;
  return {
    ...(item as StationAqi),
    aqi: numOrNull(item.aqi),
    band: item.band ?? null,
    prominent: item.prominent ?? null,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : null,
    pollutants: Array.isArray(item.pollutants) ? item.pollutants : [],
    insufficient: item.insufficient === true,
  };
}

function cleanCity(value: unknown): CityAqi | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<CityAqi>;
  if (!isText(item.slug) || !isText(item.city)) return null;
  if (typeof item.state !== "string") return null;
  return {
    ...(item as CityAqi),
    aqi: numOrNull(item.aqi),
    band: item.band ?? null,
    prominent: item.prominent ?? null,
    stationsReporting: isNum(item.stationsReporting) ? item.stationsReporting : 0,
    stationsTotal: isNum(item.stationsTotal) ? item.stationsTotal : 0,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : null,
  };
}

/**
 * Parse and sanitise a snapshot file. Entries that are malformed are dropped
 * rather than trusted, so a hand-edited or half-written file cannot crash a
 * page; a file with no usable station at all is rejected.
 */
export function parseSnapshot(text: string): SnapshotFile | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const record = data as Partial<SnapshotFile>;
  if (typeof record.snapshotAt !== "string") return null;
  if (!Array.isArray(record.stations) || !Array.isArray(record.cities)) {
    return null;
  }
  const stations = record.stations.flatMap((item) => cleanStation(item) ?? []);
  const cities = record.cities.flatMap((item) => cleanCity(item) ?? []);
  if (stations.length === 0) return null;
  return {
    snapshotAt: record.snapshotAt,
    stations,
    cities,
    rowCount: typeof record.rowCount === "number" ? record.rowCount : 0,
  };
}

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error != null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}
