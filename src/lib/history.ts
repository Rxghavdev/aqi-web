import { mkdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { errorText, logError, logWarn } from "./log.ts";
import { shared } from "./shared.ts";
import type { CityAqi, StationAqi } from "./types.ts";

export const HISTORY_PATH = path.join(process.cwd(), ".data", "aqi.db");

const SLUG = /^[a-z0-9-]{1,120}$/;

export type TrendRange = "1m" | "6m";
export type TrendKind = "city" | "station";
export type TrendSource = "cpcb" | "model";

export type TrendPoint = {
  date: string;
  aqi: number;
};

export type TrendQuery = {
  kind: TrendKind;
  slug: string;
  range: TrendRange;
};

const handle = shared("history.handle", () => ({
  db: null as DatabaseSync | null,
  /** After the shared file fails to open, do not retry on every request. */
  failedAt: 0,
  failure: "",
}));
const OPEN_RETRY_MS = 30_000;

/**
 * Open the history database. Callers treat history as optional, so this may
 * throw and every caller must catch; repeated failures are answered from a
 * short memory instead of re-hitting the disk on each request.
 */
export function openHistory(filename = HISTORY_PATH): DatabaseSync {
  if (filename === ":memory:") return migrate(new DatabaseSync(":memory:"));
  const isShared = filename === HISTORY_PATH;
  if (isShared && handle.db) return handle.db;
  if (isShared && handle.failedAt && Date.now() - handle.failedAt < OPEN_RETRY_MS) {
    throw new Error(handle.failure);
  }

  try {
    mkdirSync(path.dirname(filename), { recursive: true });
    const db = openFile(filename);
    if (isShared) {
      handle.db = db;
      handle.failedAt = 0;
    }
    return db;
  } catch (error) {
    if (isShared) {
      handle.failedAt = Date.now();
      handle.failure = errorText(error);
      logError("history.open_failed", { error: handle.failure });
    }
    throw error;
  }
}

function openFile(filename: string): DatabaseSync {
  try {
    return configure(new DatabaseSync(filename));
  } catch (error) {
    if (!looksCorrupt(error)) throw error;
    // An unreadable file would fail every request for good. Move it aside for
    // inspection and start a fresh one; official history refills from the next
    // refresh and the model line from the next trend request.
    quarantine(filename);
    logWarn("history.quarantined", { file: path.basename(filename), error: errorText(error) });
    return configure(new DatabaseSync(filename));
  }
}

function configure(db: DatabaseSync): DatabaseSync {
  // Wait for a competing writer (a sync job, another worker) instead of
  // failing with SQLITE_BUSY.
  db.exec("PRAGMA busy_timeout = 3000");
  try {
    // WAL lets the web server read while a refresh writes. The mode is stored
    // in the file, so it only needs to succeed once; a lock here is harmless.
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA synchronous = NORMAL");
  } catch {
    /* keep the default journal */
  }
  return migrate(db);
}

export function looksCorrupt(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /malformed|not a database|corrupt/i.test(message);
}

function quarantine(filename: string): void {
  try {
    renameSync(filename, `${filename}.corrupt-${Date.now()}`);
  } catch {
    /* if it cannot be moved it cannot be fixed here either */
  }
  for (const suffix of ["-wal", "-shm"]) {
    rmSync(`${filename}${suffix}`, { force: true });
  }
}

export type HistoryStatus =
  | { status: "ok"; readings: number; newestOn: string | null }
  | { status: "unavailable"; error: string };

/** For /api/health. Never throws. */
export function historyStatus(): HistoryStatus {
  try {
    const db = openHistory();
    const row = db
      .prepare("SELECT COUNT(*) AS readings, MAX(recorded_on) AS newest FROM readings WHERE source = 'cpcb'")
      .get() as { readings: number; newest: string | null } | undefined;
    return {
      status: "ok",
      readings: Number(row?.readings ?? 0),
      newestOn: row?.newest ?? null,
    };
  } catch (error) {
    return { status: "unavailable", error: errorText(error) };
  }
}

function migrate(db: DatabaseSync): DatabaseSync {
  db.exec(`
    CREATE TABLE IF NOT EXISTS readings (
      kind TEXT NOT NULL CHECK (kind IN ('city', 'station')),
      slug TEXT NOT NULL,
      recorded_on TEXT NOT NULL,
      aqi INTEGER NOT NULL CHECK (aqi >= 0 AND aqi <= 500),
      band TEXT,
      prominent TEXT,
      source TEXT NOT NULL CHECK (source IN ('cpcb', 'model')),
      PRIMARY KEY (kind, slug, recorded_on, source)
    );
    CREATE TABLE IF NOT EXISTS model_fetches (
      kind TEXT NOT NULL,
      slug TEXT NOT NULL,
      fetched_on TEXT NOT NULL,
      PRIMARY KEY (kind, slug)
    );
  `);
  return db;
}

export function kolkataDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function rangeStart(range: TrendRange, today = kolkataDate()): string {
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - (range === "1m" ? 30 : 182));
  return date.toISOString().slice(0, 10);
}

export function parseTrendQuery(input: {
  kind?: string | null;
  slug?: string | null;
  range?: string | null;
}): TrendQuery | null {
  const kind = input.kind === "station" ? "station" : input.kind === "city" ? "city" : null;
  const range = input.range === "6m" ? "6m" : input.range === "1m" ? "1m" : null;
  const slug = input.slug?.trim().toLowerCase() ?? "";
  if (!kind || !range || !SLUG.test(slug)) return null;
  return { kind, slug, range };
}

export function recordOfficial(
  db: DatabaseSync,
  snapshot: { cities: CityAqi[]; stations: StationAqi[] },
  recordedOn = kolkataDate(),
): number {
  const stmt = db.prepare(`
    INSERT INTO readings (kind, slug, recorded_on, aqi, band, prominent, source)
    VALUES (?, ?, ?, ?, ?, ?, 'cpcb')
    ON CONFLICT (kind, slug, recorded_on, source) DO UPDATE SET
      aqi = excluded.aqi,
      band = excluded.band,
      prominent = excluded.prominent
  `);
  let count = 0;
  withTransaction(db, () => {
    for (const city of snapshot.cities) {
      if (city.aqi == null || !SLUG.test(city.slug)) continue;
      stmt.run("city", city.slug, recordedOn, city.aqi, city.band, city.prominent);
      count += 1;
    }
    for (const station of snapshot.stations) {
      if (station.aqi == null || !SLUG.test(station.slug)) continue;
      stmt.run(
        "station",
        station.slug,
        recordedOn,
        station.aqi,
        station.band,
        station.prominent,
      );
      count += 1;
    }
  });
  return count;
}

export function recordModelPoints(
  db: DatabaseSync,
  kind: TrendKind,
  slug: string,
  points: TrendPoint[],
  fetchedOn = kolkataDate(),
): void {
  if (!SLUG.test(slug)) return;
  const stmt = db.prepare(`
    INSERT INTO readings (kind, slug, recorded_on, aqi, band, prominent, source)
    VALUES (?, ?, ?, ?, NULL, NULL, 'model')
    ON CONFLICT (kind, slug, recorded_on, source) DO UPDATE SET
      aqi = excluded.aqi
  `);
  const mark = db.prepare(`
    INSERT INTO model_fetches (kind, slug, fetched_on)
    VALUES (?, ?, ?)
    ON CONFLICT (kind, slug) DO UPDATE SET fetched_on = excluded.fetched_on
  `);
  withTransaction(db, () => {
    for (const point of points) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(point.date)) continue;
      if (!Number.isInteger(point.aqi) || point.aqi < 0 || point.aqi > 500) continue;
      stmt.run(kind, slug, point.date, point.aqi);
    }
    mark.run(kind, slug, fetchedOn);
  });
}

function withTransaction(db: DatabaseSync, work: () => void): void {
  // IMMEDIATE takes the write lock up front, so busy_timeout applies cleanly
  // instead of failing a read-to-write upgrade midway.
  db.exec("BEGIN IMMEDIATE");
  try {
    work();
    db.exec("COMMIT");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* the original error is the useful one */
    }
    throw error;
  }
}

export function modelFetchedOn(
  db: DatabaseSync,
  kind: TrendKind,
  slug: string,
): string | null {
  const row = db
    .prepare(
      "SELECT fetched_on FROM model_fetches WHERE kind = ? AND slug = ?",
    )
    .get(kind, slug) as { fetched_on: string } | undefined;
  return row?.fetched_on ?? null;
}

export function readTrend(
  db: DatabaseSync,
  query: TrendQuery,
  today = kolkataDate(),
): { official: TrendPoint[]; model: TrendPoint[] } {
  const start = rangeStart(query.range, today);
  const stmt = db.prepare(`
    SELECT recorded_on AS date, aqi
    FROM readings
    WHERE kind = ? AND slug = ? AND source = ? AND recorded_on >= ? AND recorded_on <= ?
    ORDER BY recorded_on ASC
  `);
  const official = points(stmt.all(query.kind, query.slug, "cpcb", start, today));
  const model = points(stmt.all(query.kind, query.slug, "model", start, today));
  return { official, model };
}

function points(rows: unknown): TrendPoint[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (row == null || typeof row !== "object") return [];
    const date = "date" in row ? row.date : null;
    const aqi = "aqi" in row ? row.aqi : null;
    if (typeof date !== "string" || typeof aqi !== "number") return [];
    return [{ date, aqi }];
  });
}
