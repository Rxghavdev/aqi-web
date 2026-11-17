import assert from "node:assert/strict";
import test from "node:test";
import {
  bandFor,
  indiaAqiFromConcentration,
  normalizePollutant,
} from "./aqi.ts";

test("PM2.5 lands on CPCB band edges", () => {
  assert.equal(indiaAqiFromConcentration("PM2.5", 0), 0);
  assert.equal(indiaAqiFromConcentration("PM2.5", 30), 50);
  assert.equal(indiaAqiFromConcentration("PM2.5", 31), 51);
  assert.equal(indiaAqiFromConcentration("PM2.5", 60), 100);
  assert.equal(indiaAqiFromConcentration("PM2.5", 90), 200);
  assert.equal(indiaAqiFromConcentration("PM2.5", 120), 300);
  assert.equal(indiaAqiFromConcentration("PM2.5", 250), 400);
  assert.equal(indiaAqiFromConcentration("PM2.5", 251), 401);
  assert.equal(indiaAqiFromConcentration("PM2.5", 500), 500);
  assert.equal(indiaAqiFromConcentration("PM2.5", 800), 500);
});

test("PM10 and CO use their own units", () => {
  assert.equal(indiaAqiFromConcentration("PM10", 50), 50);
  assert.equal(indiaAqiFromConcentration("PM10", 100), 100);
  assert.equal(indiaAqiFromConcentration("PM10", 250), 200);
  assert.equal(indiaAqiFromConcentration("CO", 1), 50);
  assert.equal(indiaAqiFromConcentration("CO", 2), 100);
  assert.equal(indiaAqiFromConcentration("CO", 10), 200);
});

test("bands follow the India scale, not the US scale", () => {
  assert.equal(bandFor(50), "Good");
  assert.equal(bandFor(51), "Satisfactory");
  assert.equal(bandFor(100), "Satisfactory");
  assert.equal(bandFor(101), "Moderate");
  assert.equal(bandFor(200), "Moderate");
  assert.equal(bandFor(201), "Poor");
  assert.equal(bandFor(300), "Poor");
  assert.equal(bandFor(301), "Very Poor");
  assert.equal(bandFor(400), "Very Poor");
  assert.equal(bandFor(401), "Severe");
  assert.equal(bandFor(null), null);
});

test("pollutant names from the government feed normalize", () => {
  assert.equal(normalizePollutant("PM2.5"), "PM2.5");
  assert.equal(normalizePollutant("Ozone"), "OZONE");
  assert.equal(normalizePollutant("o3"), "OZONE");
  assert.equal(normalizePollutant("nope"), null);
});
