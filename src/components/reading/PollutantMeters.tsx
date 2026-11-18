import type { PollutantId, PollutantReading } from "@/lib/types";
import { pollutantLabel } from "./text";

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

export function PollutantMeters({ pollutants }: { pollutants: PollutantReading[] }) {
  const rows = meterRows(pollutants);
  if (rows.length === 0) return null;

  return (
    <div className="meters">
      <p className="meters-label">Sub-index</p>
      <ul className="meter-grid">
        {rows.map((reading) => {
          const value = reading.subIndex ?? 0;
          const width = Math.max(0, Math.min(100, (value / 500) * 100));
          return (
            <li key={reading.id} className="meter-cell">
              <span className="meter-name">{pollutantLabel(reading.id)}</span>
              <span className="meter-value">
                {value}
                <span className="sr-only"> sub-index</span>
              </span>
              <span className="meter-track" aria-hidden="true">
                <span className="meter-fill" style={{ width: `${width}%` }} />
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
