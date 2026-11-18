"use client";

import { useId, useState } from "react";
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
  "PM2.5":
    "Fine particles under 2.5 micrometres. Small enough to reach deep into the lungs, and usually the driver in north Indian winters.",
  PM10: "Coarser dust, smoke and road grit, up to 10 micrometres. It settles faster but still inflames the airways.",
  NO2: "Nitrogen dioxide, mostly from traffic and fuel burning. Peaks near congested roads.",
  SO2: "Sulphur dioxide, mainly from burning coal and oil. A marker of industrial and domestic fuel use.",
  CO: "Carbon monoxide from incomplete burning. CPCB compares an 8-hour average rather than an instant reading.",
  OZONE: "Ground-level ozone, formed in sunlight from other pollutants. CPCB compares an 8-hour average, so it peaks in the afternoon.",
  NH3: "Ammonia, often from fertiliser, livestock and waste. It also feeds the chemistry that makes fine particles.",
  PB: "Lead, which travels as fine dust and stays in the air. Monitored at a small number of stations.",
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
 * One tile per pollutant. Opening a tile reveals the detail directly beneath
 * the row, and opening another closes the first, so the section never
 * stretches into a wall of text.
 */
export function PollutantBoard({
  pollutants,
}: {
  pollutants: PollutantReading[];
}) {
  const rows = meterRows(pollutants);
  const baseId = useId();
  const [open, setOpen] = useState<PollutantId | null>(null);
  if (rows.length === 0) return null;

  const highest = Math.max(...rows.map((row) => row.subIndex ?? 0));
  const current = rows.find((row) => row.id === open) ?? null;

  return (
    <div className="board">
      <ul className="board-list">
        {rows.map((reading) => {
          const value = reading.subIndex ?? 0;
          const width = Math.max(2, Math.min(100, (value / 500) * 100));
          const band = bandFor(value);
          const top = value === highest;
          const expanded = open === reading.id;
          const panelId = `${baseId}-${reading.id}-panel`;
          return (
            <li key={reading.id}>
              <button
                type="button"
                className={expanded ? "pollutant is-open" : "pollutant"}
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => setOpen(expanded ? null : reading.id)}
              >
                <span className="pollutant-name">
                  <span className="pollutant-label">{pollutantLabel(reading.id)}</span>
                  {top ? <span className="pollutant-flag">Sets the number</span> : null}
                </span>
                <span className="pollutant-track" aria-hidden="true">
                  <span
                    className="pollutant-fill"
                    style={{ width: `${width}%`, background: bandAccent(band) }}
                  />
                </span>
                <span className="pollutant-read">
                  <span className="pollutant-value">{value}</span>
                  <span className="pollutant-band" style={{ color: bandAccent(band) }}>
                    {bandLabel(band)}
                  </span>
                </span>
                <span className="pollutant-cue" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      {current ? (
        <div
          className="pollutant-detail"
          id={`${baseId}-${current.id}-panel`}
          role="region"
          aria-live="polite"
        >
          <p className="pollutant-detail-title">
            {pollutantLabel(current.id)}
            <span>sub-index {current.subIndex} of 500</span>
          </p>
          <p>{WHAT_IT_IS[current.id]}</p>
          <p className="pollutant-detail-note">
            CPCB publishes this as an index point, not as a concentration in
            micrograms. The station number is the worst sub-index across its
            pollutants.
          </p>
        </div>
      ) : null}
    </div>
  );
}
