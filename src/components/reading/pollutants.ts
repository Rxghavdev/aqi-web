import type { PollutantId, PollutantReading } from "@/lib/types";

const METER_ORDER: PollutantId[] = [
  "PM2.5",
  "PM10",
  "OZONE",
  "NO2",
  "SO2",
  "CO",
  "NH3",
  "PB",
];

/** Pollutants with a published sub-index, in a fixed reading order. */
export function meterRows(pollutants: PollutantReading[]): PollutantReading[] {
  const byId = new Map(pollutants.map((item) => [item.id, item]));
  const rows: PollutantReading[] = [];
  for (const id of METER_ORDER) {
    const reading = byId.get(id);
    if (reading && numeric(reading.subIndex)) rows.push(reading);
  }
  for (const reading of pollutants) {
    if (rows.some((row) => row.id === reading.id)) continue;
    if (numeric(reading.subIndex)) rows.push(reading);
  }
  return rows;
}

function numeric(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
