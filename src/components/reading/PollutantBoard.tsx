"use client";

import { useId, useState } from "react";
import { bandAccent, bandFor, bandTextColor } from "@/lib/aqi";
import type { PollutantId, PollutantReading } from "@/lib/types";
import { Icon } from "./icons";
import { meterRows } from "./pollutants";
import { bandLabel, pollutantLabel } from "./text";

type Copy = { hint: string; what: string; sources: string };

const COPY: Record<PollutantId, Copy> = {
  "PM2.5": {
    hint: "Fine particles",
    what: "Particles smaller than 2.5 micrometres, a fraction of the width of a hair.",
    sources: "Vehicle exhaust, burning of crops, wood and waste, and industry.",
  },
  PM10: {
    hint: "Coarse dust",
    what: "Dust and soot up to 10 micrometres across.",
    sources: "Road and construction dust, vehicle wear and open burning.",
  },
  NO2: {
    hint: "Nitrogen dioxide",
    what: "A gas formed when fuel burns at high temperature.",
    sources: "Vehicles, power plants and industry. Highest near busy roads.",
  },
  SO2: {
    hint: "Sulphur dioxide",
    what: "A gas released when fuel containing sulphur burns.",
    sources: "Coal and oil burning in power plants and factories.",
  },
  CO: {
    hint: "Carbon monoxide",
    what: "A gas produced by incomplete burning. The index uses an 8-hour average.",
    sources: "Vehicles, cooking fires and waste burning.",
  },
  OZONE: {
    hint: "Ground-level ozone",
    what: "A gas that forms in sunlight from other pollutants. The index uses an 8-hour average.",
    sources:
      "Not emitted directly. It forms from vehicle and industrial gases and peaks in the afternoon.",
  },
  NH3: {
    hint: "Ammonia",
    what: "A gas with a sharp smell.",
    sources: "Fertiliser, livestock and waste.",
  },
  PB: {
    hint: "Lead dust",
    what: "A metal carried in the air as fine dust. Few stations measure it.",
    sources: "Battery recycling, smelters and some industrial processes.",
  },
};

/**
 * One tile per pollutant. Each tile is a three-column grid: name and hint,
 * value and band, then a chevron in its own 44px column, so nothing can sit
 * on top of anything else. One tile is open at a time; the panel grows with a
 * height transition and the meter shows the sub-index on the 0–500 scale.
 */
export function PollutantBoard({
  pollutants,
  showSetter = true,
}: {
  pollutants: PollutantReading[];
  /** False when the station has no AQI, so no pollutant "sets" anything. */
  showSetter?: boolean;
}) {
  const rows = meterRows(pollutants);
  const baseId = useId();
  const [open, setOpen] = useState<PollutantId | null>(null);
  if (rows.length === 0) return null;

  const highest = Math.max(...rows.map((row) => row.subIndex ?? 0));
  const setter = rows.find((row) => row.subIndex === highest) ?? rows[0];

  return (
    <ul className="ptiles">
      {rows.map((reading) => {
        const value = reading.subIndex ?? 0;
        const percent = Math.max(1.5, Math.min(100, (value / 500) * 100));
        const band = bandFor(value);
        const top = showSetter && value === highest;
        const expanded = open === reading.id;
        const copy = COPY[reading.id];
        const buttonId = `${baseId}-${reading.id}-btn`;
        const panelId = `${baseId}-${reading.id}-panel`;
        const name = pollutantLabel(reading.id);
        return (
          <li key={reading.id} className={expanded ? "ptile is-open" : "ptile"}>
            <h3 className="ptile-heading">
              <button
                id={buttonId}
                type="button"
                className="ptile-btn"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => setOpen(expanded ? null : reading.id)}
              >
                <span className="ptile-name">
                  <span className="ptile-title">
                    <span className="ptile-label">{name}</span>
                    {top ? (
                      <span className="ptile-tag">Sets the AQI</span>
                    ) : null}
                  </span>
                  <span className="ptile-hint">{copy.hint}</span>
                </span>
                <span className="ptile-read">
                  <span className="ptile-value">
                    <span className="sr-only">Sub-index </span>
                    {value}
                  </span>
                  <span
                    className="ptile-chip"
                    style={{ borderColor: bandBorder(band) }}
                  >
                    <span
                      className="ptile-dot"
                      style={{ background: bandAccent(band) }}
                      aria-hidden="true"
                    />
                    <span style={{ color: bandTextColor(band) }}>
                      {bandLabel(band)}
                    </span>
                  </span>
                </span>
                <span className="ptile-chev" aria-hidden="true">
                  <Icon name="chevron" size={20} />
                </span>
                <span className="ptile-meter" aria-hidden="true">
                  <span
                    className="ptile-fill"
                    style={{
                      width: `${percent}%`,
                      background: bandAccent(band),
                    }}
                  />
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              className="ptile-panel"
              role="region"
              aria-labelledby={buttonId}
              inert={!expanded}
            >
              <div className="ptile-panel-inner">
                <dl className="ptile-copy">
                  <div>
                    <dt>What it is</dt>
                    <dd>{copy.what}</dd>
                  </div>
                  <div>
                    <dt>Main sources</dt>
                    <dd>{copy.sources}</dd>
                  </div>
                  <div>
                    <dt>Reading</dt>
                    <dd>
                      Sub-index {value} of 500, {bandLabel(band)}.{" "}
                      {showSetter
                        ? top
                          ? "The highest at this station, so it sets the AQI."
                          : `The AQI is set by ${pollutantLabel(setter.id)} at ${highest}.`
                        : ""}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function bandBorder(band: ReturnType<typeof bandFor>): string {
  return `color-mix(in srgb, ${bandAccent(band)} 55%, transparent)`;
}
