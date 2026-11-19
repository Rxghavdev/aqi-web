import assert from "node:assert/strict";
import test from "node:test";
import { backoffMs, looksPartial, parseSnapshot } from "./snapshot.ts";

const station = (slug: string, extra: Record<string, unknown> = {}) => ({
  slug,
  name: `Station ${slug}`,
  city: "Delhi",
  state: "Delhi",
  latitude: 28.6,
  longitude: 77.2,
  aqi: 150,
  band: "Moderate",
  prominent: "PM2.5",
  updatedAt: null,
  pollutants: [],
  insufficient: false,
  ...extra,
});

const city = {
  slug: "delhi-delhi",
  city: "Delhi",
  state: "Delhi",
  aqi: 150,
  band: "Moderate",
  prominent: "PM2.5",
  stationsReporting: 1,
  stationsTotal: 1,
  updatedAt: null,
};

test("a good snapshot parses", () => {
  const parsed = parseSnapshot(
    JSON.stringify({ snapshotAt: "2026-11-18T10:00:00Z", stations: [station("a")], cities: [city], rowCount: 9 }),
  );
  assert.equal(parsed?.stations.length, 1);
  assert.equal(parsed?.cities.length, 1);
  assert.equal(parsed?.rowCount, 9);
});

test("truncated or non-JSON files are rejected, not thrown", () => {
  assert.equal(parseSnapshot('{"snapshotAt":"2026-11-18T10:00:00Z","stations":[{"slu'), null);
  assert.equal(parseSnapshot(""), null);
  assert.equal(parseSnapshot("null"), null);
  assert.equal(parseSnapshot("[]"), null);
});

test("files missing required parts are rejected", () => {
  assert.equal(parseSnapshot(JSON.stringify({ stations: [], cities: [] })), null);
  assert.equal(parseSnapshot(JSON.stringify({ snapshotAt: "x", stations: {}, cities: [] })), null);
  assert.equal(parseSnapshot(JSON.stringify({ snapshotAt: "x", stations: [], cities: [] })), null);
});

test("malformed entries are dropped instead of crashing a page", () => {
  const parsed = parseSnapshot(
    JSON.stringify({
      snapshotAt: "2026-11-18T10:00:00Z",
      stations: [
        station("ok"),
        null,
        "text",
        station("no-coords", { latitude: "north" }),
        station("nan", { longitude: null }),
        { slug: "half" },
        station("sparse", { pollutants: undefined, band: undefined, aqi: "high" }),
      ],
      cities: [city, null, { slug: 1 }],
    }),
  );
  assert.deepEqual(
    parsed?.stations.map((item) => item.slug),
    ["ok", "sparse"],
  );
  const sparse = parsed?.stations[1];
  assert.equal(sparse?.aqi, null);
  assert.equal(sparse?.band, null);
  assert.deepEqual(sparse?.pollutants, []);
  assert.equal(parsed?.cities.length, 1);
});

test("a partial feed is recognised only against a substantial snapshot", () => {
  const many = { stations: new Array(400).fill(0) };
  assert.equal(looksPartial(many, { stations: new Array(150).fill(0) }), true);
  assert.equal(looksPartial(many, { stations: new Array(390).fill(0) }), false);
  assert.equal(looksPartial(null, { stations: [] }), false);
  assert.equal(looksPartial({ stations: new Array(10).fill(0) }, { stations: [] }), false);
});

test("refresh backoff grows and is capped", () => {
  assert.equal(backoffMs(0), 0);
  assert.equal(backoffMs(1), 5 * 60_000);
  assert.equal(backoffMs(2), 10 * 60_000);
  assert.equal(backoffMs(3), 20 * 60_000);
  assert.equal(backoffMs(4), 30 * 60_000);
  assert.equal(backoffMs(40), 30 * 60_000);
});
