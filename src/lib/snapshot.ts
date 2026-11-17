import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { aggregateRecords } from "./aggregate.ts";
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

let memory: Memory | null = null;
let inflight: Promise<SnapshotFile> | null = null;

/**
 * Read the on-disk snapshot. Never downloads.
 * A missing cache returns null quickly.
 */
export async function readSnapshot(): Promise<{
  snapshot: SnapshotFile | null;
  stale: boolean;
}> {
  try {
    const info = await stat(SNAPSHOT_PATH);
    if (memory && memory.mtimeMs === info.mtimeMs) {
      return { snapshot: memory.snapshot, stale: isStale(memory) };
    }
    const text = await readFile(SNAPSHOT_PATH, "utf8");
    const snapshot = parseSnapshot(text);
    if (!snapshot) return { snapshot: memory?.snapshot ?? null, stale: true };
    memory = {
      snapshot,
      mtimeMs: info.mtimeMs,
      refreshFailed: false,
    };
    return { snapshot, stale: isStale(memory) };
  } catch (error) {
    if (isEnoent(error)) {
      return { snapshot: null, stale: true };
    }
    return { snapshot: memory?.snapshot ?? null, stale: true };
  }
}

/**
 * Download a new snapshot. One refresh runs at a time.
 * Readers of `readSnapshot` keep the previous file while this is in flight.
 * If the download throws and an older file is already loaded, it stays
 * available with stale set.
 */
export function refreshSnapshot(force = false): Promise<SnapshotFile> {
  if (inflight) return inflight;
  inflight = doRefresh(force).finally(() => {
    inflight = null;
  });
  return inflight;
}

async function doRefresh(force: boolean): Promise<SnapshotFile> {
  const current = await readSnapshot();
  if (!force && current.snapshot && !current.stale) return current.snapshot;

  try {
    const records = await fetchAllCpcbRecords();
    const { stations, cities } = aggregateRecords(records);
    const snapshot: SnapshotFile = {
      snapshotAt: new Date().toISOString(),
      stations,
      cities,
      rowCount: records.length,
    };
    await writeSnapshot(snapshot);
    return snapshot;
  } catch (error) {
    if (memory) memory.refreshFailed = true;
    throw error;
  }
}

async function writeSnapshot(snapshot: SnapshotFile): Promise<void> {
  await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
  const tmp = `${SNAPSHOT_PATH}.tmp`;
  await writeFile(tmp, JSON.stringify(snapshot));
  await rename(tmp, SNAPSHOT_PATH);
  const info = await stat(SNAPSHOT_PATH);
  memory = {
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

function parseSnapshot(text: string): SnapshotFile | null {
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
  return {
    snapshotAt: record.snapshotAt,
    stations: record.stations,
    cities: record.cities,
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
