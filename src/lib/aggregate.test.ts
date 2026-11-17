import assert from "node:assert/strict";
import test from "node:test";
import { aggregateRecords, type CpcbRecord } from "./aggregate.ts";

function row(overrides: Partial<CpcbRecord> = {}): CpcbRecord {
  return {
    state: "Delhi",
    city: "Delhi",
    station: "ITO",
    last_update: "17-11-2026 10:00:00",
    latitude: "28.63",
    longitude: "77.25",
    pollutant_id: "PM2.5",
    avg_value: "100",
    ...overrides,
  };
}

test("fewer than 3 pollutants is insufficient", () => {
  const { stations } = aggregateRecords([
    row({ pollutant_id: "PM2.5", avg_value: "300" }),
    row({ pollutant_id: "PM10", avg_value: "200" }),
  ]);
  assert.equal(stations.length, 1);
  assert.equal(stations[0]?.aqi, null);
  assert.equal(stations[0]?.band, null);
  assert.equal(stations[0]?.prominent, null);
  assert.equal(stations[0]?.insufficient, true);
  assert.equal(stations[0]?.pollutants.length, 2);
});

test("three pollutants without PM2.5 or PM10 stay insufficient", () => {
  const { stations } = aggregateRecords([
    row({ pollutant_id: "NO2", avg_value: "180" }),
    row({ pollutant_id: "SO2", avg_value: "90" }),
    row({ pollutant_id: "CO", avg_value: "40" }),
  ]);
  assert.equal(stations[0]?.aqi, null);
  assert.equal(stations[0]?.insufficient, true);
  assert.equal(stations[0]?.band, null);
  assert.equal(stations[0]?.pollutants.length, 3);
});

test("three pollutants including PM2.5 use the max sub-index", () => {
  const { stations } = aggregateRecords([
    row({ pollutant_id: "PM2.5", avg_value: "120" }),
    row({ pollutant_id: "NO2", avg_value: "180" }),
    row({ pollutant_id: "SO2", avg_value: "90" }),
  ]);
  assert.equal(stations[0]?.insufficient, false);
  assert.equal(stations[0]?.aqi, 180);
  assert.equal(stations[0]?.prominent, "NO2");
  assert.equal(stations[0]?.band, "Moderate");
});

test("NA is ignored", () => {
  const { stations } = aggregateRecords([
    row({ pollutant_id: "PM2.5", avg_value: "150" }),
    row({ pollutant_id: "PM10", avg_value: "NA" }),
    row({ pollutant_id: "NO2", avg_value: "80" }),
    row({ pollutant_id: "SO2", avg_value: "70" }),
    row({ pollutant_id: "CO", avg_value: "" }),
    row({ pollutant_id: "NH3", avg_value: null }),
  ]);
  assert.equal(stations[0]?.aqi, 150);
  assert.equal(stations[0]?.prominent, "PM2.5");
  assert.equal(stations[0]?.insufficient, false);
  const pm10 = stations[0]?.pollutants.find((item) => item.id === "PM10");
  assert.ok(pm10);
  assert.equal(pm10?.subIndex, null);
  assert.equal(
    stations[0]?.pollutants.find((item) => item.id === "CO")?.subIndex,
    null,
  );
  assert.equal(
    stations[0]?.pollutants.find((item) => item.id === "NH3")?.subIndex,
    null,
  );
});

test("city mean rounds", () => {
  const place = {
    state: "Maharashtra",
    city: "Pune",
    latitude: "18.52",
    longitude: "73.85",
  };
  const station = (name: string, pm25: string) => [
    row({ ...place, station: name, pollutant_id: "PM2.5", avg_value: pm25 }),
    row({ ...place, station: name, pollutant_id: "PM10", avg_value: "40" }),
    row({ ...place, station: name, pollutant_id: "NO2", avg_value: "30" }),
  ];
  const { cities } = aggregateRecords([
    ...station("Hadapsar", "100"),
    ...station("Shivajinagar", "101"),
    row({
      ...place,
      station: "Quiet",
      pollutant_id: "PM2.5",
      avg_value: "400",
    }),
  ]);
  assert.equal(cities.length, 1);
  assert.equal(cities[0]?.aqi, 101);
  assert.equal(cities[0]?.band, "Moderate");
  assert.equal(cities[0]?.stationsReporting, 2);
  assert.equal(cities[0]?.stationsTotal, 3);
});

test("Ozone normalizes to OZONE", () => {
  const { stations } = aggregateRecords([
    row({ pollutant_id: "Ozone", avg_value: "77" }),
    row({ pollutant_id: "PM2.5", avg_value: "40" }),
    row({ pollutant_id: "NO2", avg_value: "30" }),
  ]);
  assert.equal(
    stations[0]?.pollutants.some((item) => item.id === "OZONE"),
    true,
  );
  assert.equal(stations[0]?.prominent, "OZONE");
  assert.equal(stations[0]?.aqi, 77);
  assert.equal(stations[0]?.insufficient, false);
});
