import assert from "node:assert/strict";
import test from "node:test";
import {
  openHistory,
  parseTrendQuery,
  rangeStart,
  readTrend,
  recordOfficial,
} from "./history.ts";
import type { CityAqi, StationAqi } from "./types.ts";

function city(aqi: number, slug = "delhi-delhi"): CityAqi {
  return {
    slug,
    city: "Delhi",
    state: "Delhi",
    aqi,
    band: "Moderate",
    prominent: "PM2.5",
    stationsReporting: 1,
    stationsTotal: 1,
    updatedAt: null,
  };
}

test("rejects slugs that are not safe keys", () => {
  assert.equal(parseTrendQuery({ kind: "city", slug: "../etc", range: "1m" }), null);
  assert.equal(parseTrendQuery({ kind: "city", slug: "delhi'; drop", range: "1m" }), null);
  assert.equal(parseTrendQuery({ kind: "nope", slug: "delhi-delhi", range: "1m" }), null);
  assert.deepEqual(
    parseTrendQuery({ kind: "city", slug: "Delhi-Delhi", range: "9m" }),
    null,
  );
  assert.deepEqual(parseTrendQuery({ kind: "station", slug: "delhi-ito", range: "6m" }), {
    kind: "station",
    slug: "delhi-ito",
    range: "6m",
  });
});

test("same day official reading is replaced, not duplicated", () => {
  const db = openHistory(":memory:");
  const station = {
    slug: "delhi-ito",
    name: "ITO",
    city: "Delhi",
    state: "Delhi",
    latitude: 1,
    longitude: 1,
    aqi: 100,
    band: "Satisfactory",
    prominent: "PM2.5",
    updatedAt: null,
    pollutants: [],
    insufficient: false,
  } satisfies StationAqi;
  recordOfficial(db, { cities: [city(180)], stations: [station] }, "2026-11-17");
  recordOfficial(
    db,
    { cities: [city(210)], stations: [{ ...station, aqi: 220, band: "Poor" }] },
    "2026-11-17",
  );
  const trend = readTrend(
    db,
    { kind: "city", slug: "delhi-delhi", range: "1m" },
    "2026-11-17",
  );
  assert.deepEqual(trend.official, [{ date: "2026-11-17", aqi: 210 }]);
  const stationTrend = readTrend(
    db,
    { kind: "station", slug: "delhi-ito", range: "1m" },
    "2026-11-17",
  );
  assert.equal(stationTrend.official[0]?.aqi, 220);
});

test("one month window drops older points", () => {
  const db = openHistory(":memory:");
  recordOfficial(db, { cities: [city(100)], stations: [] }, "2026-09-01");
  recordOfficial(db, { cities: [city(180)], stations: [] }, "2026-11-01");
  const trend = readTrend(
    db,
    { kind: "city", slug: "delhi-delhi", range: "1m" },
    "2026-11-17",
  );
  assert.deepEqual(trend.official, [{ date: "2026-11-01", aqi: 180 }]);
  assert.equal(rangeStart("6m", "2026-11-17") < "2026-09-01", true);
});
