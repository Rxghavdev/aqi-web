import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { looksCorrupt, openHistory, readTrend, recordOfficial } from "./history.ts";
import type { CityAqi, StationAqi } from "./types.ts";

const city: CityAqi = {
  slug: "delhi-delhi",
  city: "Delhi",
  state: "Delhi",
  aqi: 180,
  band: "Moderate",
  prominent: "PM2.5",
  stationsReporting: 1,
  stationsTotal: 1,
  updatedAt: null,
};

const station: StationAqi = {
  slug: "anand-vihar-delhi",
  name: "Anand Vihar",
  city: "Delhi",
  state: "Delhi",
  latitude: 28.6,
  longitude: 77.3,
  aqi: 210,
  band: "Poor",
  prominent: "PM2.5",
  updatedAt: null,
  pollutants: [],
  insufficient: false,
};

function scratch(): { dir: string; file: string } {
  const dir = mkdtempSync(path.join(tmpdir(), "hawa-history-"));
  return { dir, file: path.join(dir, "aqi.db") };
}

test("a file database runs in WAL mode with a busy timeout", () => {
  const { dir, file } = scratch();
  try {
    const db = openHistory(file);
    const mode = db.prepare("PRAGMA journal_mode").get() as { journal_mode: string };
    const wait = db.prepare("PRAGMA busy_timeout").get() as { timeout: number };
    assert.equal(mode.journal_mode, "wal");
    assert.equal(wait.timeout, 3000);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writing the same snapshot repeatedly is idempotent", () => {
  const db = openHistory(":memory:");
  const snapshot = { cities: [city], stations: [station] };
  recordOfficial(db, snapshot, "2026-11-18");
  recordOfficial(db, snapshot, "2026-11-18");
  recordOfficial(db, { cities: [{ ...city, aqi: 200 }], stations: [station] }, "2026-11-18");
  const rows = db.prepare("SELECT COUNT(*) AS n FROM readings").get() as { n: number };
  assert.equal(rows.n, 2);
  const trend = readTrend(db, { kind: "city", slug: "delhi-delhi", range: "1m" }, "2026-11-18");
  assert.deepEqual(trend.official, [{ date: "2026-11-18", aqi: 200 }]);
});

test("a corrupt database file is moved aside and replaced, not fatal", () => {
  const { dir, file } = scratch();
  try {
    writeFileSync(file, "this is not a sqlite database, just text ".repeat(50));
    const db = openHistory(file);
    // Usable straight away.
    recordOfficial(db, { cities: [city], stations: [] }, "2026-11-18");
    const rows = db.prepare("SELECT COUNT(*) AS n FROM readings").get() as { n: number };
    assert.equal(rows.n, 1);
    db.close();
    const names = readdirSync(dir);
    assert.ok(names.some((name) => name.startsWith("aqi.db.corrupt-")), names.join(","));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a failed write rolls back and leaves the database usable", () => {
  const db = openHistory(":memory:");
  const bad = { cities: [{ ...city, aqi: 9_999 }], stations: [] }; // violates CHECK
  assert.throws(() => recordOfficial(db, bad, "2026-11-18"));
  recordOfficial(db, { cities: [city], stations: [] }, "2026-11-18");
  const rows = db.prepare("SELECT COUNT(*) AS n FROM readings").get() as { n: number };
  assert.equal(rows.n, 1);
});

test("corruption is recognised from the sqlite message", () => {
  assert.equal(looksCorrupt(new Error("file is not a database")), true);
  assert.equal(looksCorrupt(new Error("database disk image is malformed")), true);
  assert.equal(looksCorrupt(new Error("database is locked")), false);
});
