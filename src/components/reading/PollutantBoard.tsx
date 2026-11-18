import { bandAccent, bandFor } from "@/lib/aqi";
import type { PollutantId, PollutantReading } from "@/lib/types";
import { bandLabel, pollutantLabel } from "./text";

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

const WHAT_IT_IS: Record<PollutantId, string> = {
  "PM2.5": "Fine particles under 2.5 micrometres. Usually the driver in north Indian winters.",
  PM10: "Coarser dust, smoke and road grit, up to 10 micrometres.",
  NO2: "Nitrogen dioxide, mostly from traffic and fuel burning.",
  SO2: "Sulphur dioxide, mainly from burning coal and oil.",
  CO: "Carbon monoxide from incomplete burning. CPCB compares an 8-hour average.",
  OZONE: "Ground-level ozone, formed in sunlight. CPCB compares an 8-hour average.",
  NH3: "Ammonia, often from fertiliser, livestock and waste.",
  PB: "Lead, which travels as fine dust and stays in the air.",
};

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

/**
 * One tile per pollutant. Opening a tile explains what the pollutant is
 * and repeats the sub-index that CPCB actually published.
 */
export function PollutantBoard({
  pollutants,
}: {
  pollutants: PollutantReading[];
}) {
  const rows = meterRows(pollutants);
  if (rows.length === 0) return null;
  const highest = Math.max(...rows.map((row) => row.subIndex ?? 0));

  return (
    <div className="board">
      <ul className="board-grid">
        {rows.map((reading) => {
          const value = reading.subIndex ?? 0;
          const width = Math.max(1.5, Math.min(100, (value / 500) * 100));
          const band = bandFor(value);
          const top = value === highest;
          return (
            <li key={reading.id}>
              <details className="tile">
                <summary className="tile-summary">
                  <span className="tile-top">
                    <span className="tile-name">{pollutantLabel(reading.id)}</span>
                    <span className="tile-value" style={{ color: bandAccent(band) }}>
                      {value}
                      <span className="sr-only"> sub-index</span>
                    </span>
                  </span>
                  <span className="tile-bar" aria-hidden="true">
                    <span
                      className="tile-fill"
                      style={{
                        width: `${width}%`,
                        background: bandAccent(band),
                      }}
                    />
                  </span>
                  <span className="tile-foot">
                    <span className="tile-band">{bandLabel(band)}</span>
                    {top ? <span className="tile-flag">Sets the number</span> : null}
                    <span className="tile-cue" aria-hidden="true" />
                  </span>
                  <span className="sr-only">Open for detail</span>
                </summary>
                <div className="tile-detail">
                  <p>{WHAT_IT_IS[reading.id]}</p>
                  <p className="tile-meta">
                    Sub-index {value} of 500. CPCB publishes this as the index
                    point, not as a concentration.
                  </p>
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
