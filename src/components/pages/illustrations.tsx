import type { CSSProperties } from "react";
import { bandAccent, bandFor, bandNumberColor, bandTextColor } from "@/lib/aqi";
import { BANDS, type Band } from "@/lib/types";

const RANGES: Record<Band, string> = {
  Good: "0–50",
  Satisfactory: "51–100",
  Moderate: "101–200",
  Poor: "201–300",
  "Very Poor": "301–400",
  Severe: "401–500",
};

function bandVars(band: Band | null): CSSProperties {
  return {
    "--accent": bandAccent(band),
    "--band-text": bandTextColor(band),
    "--band-num": bandNumberColor(band),
  } as CSSProperties;
}

/** The six CPCB bands as coloured chips with their index ranges. */
export function BandChips() {
  return (
    <ul className="pg-bands" aria-label="AQI bands">
      {BANDS.map((band) => (
        <li key={band} className="pg-band" style={bandVars(band)}>
          <span className="pg-band-name">{band}</span>
          <span className="pg-band-range">{RANGES[band]}</span>
        </li>
      ))}
    </ul>
  );
}

const EXAMPLE_STATION: ReadonlyArray<{ id: string; subIndex: number }> = [
  { id: "PM2.5", subIndex: 262 },
  { id: "PM10", subIndex: 189 },
  { id: "NO2", subIndex: 71 },
  { id: "CO", subIndex: 56 },
  { id: "Ozone", subIndex: 43 },
  { id: "SO2", subIndex: 18 },
];

/** One station, six sub-indices: the highest one is the station AQI. */
export function StationExample() {
  const top = EXAMPLE_STATION.reduce((best, item) =>
    item.subIndex > best.subIndex ? item : best,
  );
  const band = bandFor(top.subIndex);
  return (
    <figure className="pg-card pg-example">
      <figcaption className="pg-example-head">
        <span className="pg-example-title">Worked example</span>
        <span className="pg-example-sub">One station, six sub-indices</span>
      </figcaption>
      <ul className="pg-bars">
        {EXAMPLE_STATION.map((item) => {
          const winner = item.id === top.id;
          return (
            <li
              key={item.id}
              className={winner ? "pg-bar is-top" : "pg-bar"}
              style={winner ? bandVars(band) : undefined}
            >
              <span className="pg-bar-label">{item.id}</span>
              <span className="pg-bar-track" aria-hidden="true">
                <span
                  className="pg-bar-fill"
                  style={{ width: `${(item.subIndex / 500) * 100}%` }}
                />
              </span>
              <span className="pg-bar-value">{item.subIndex}</span>
            </li>
          );
        })}
      </ul>
      <div className="pg-example-result" style={bandVars(band)}>
        <span className="pg-result-label">Station AQI</span>
        <span className="pg-result-value">{top.subIndex}</span>
        <span className="pg-result-band">{band}</span>
        <span className="pg-result-note">Set by {top.id}, the highest sub-index.</span>
      </div>
    </figure>
  );
}

const EXAMPLE_CITY: ReadonlyArray<{ name: string; aqi: number | null }> = [
  { name: "Station A", aqi: 212 },
  { name: "Station B", aqi: 168 },
  { name: "Station C", aqi: 190 },
  { name: "Station D", aqi: null },
];

const Arrow = (
  <svg
    aria-hidden="true"
    focusable="false"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 5v14M6 13l6 6 6-6" />
  </svg>
);

/** How a city number is made: station AQIs in, rounded mean out. */
export function CityFlow() {
  const used = EXAMPLE_CITY.filter(
    (item): item is { name: string; aqi: number } => item.aqi != null,
  );
  const mean = Math.round(used.reduce((sum, item) => sum + item.aqi, 0) / used.length);
  const band = bandFor(mean);
  return (
    <figure className="pg-card pg-flow">
      <figcaption className="sr-only">
        Four stations, three with an AQI. The city AQI is their mean, {mean}.
      </figcaption>
      <div className="pg-flow-in">
        <p className="pg-flow-label">Stations in one city</p>
        <ul className="pg-flow-list">
          {EXAMPLE_CITY.map((item) => (
            <li
              key={item.name}
              className={item.aqi == null ? "pg-flow-row is-out" : "pg-flow-row"}
              style={item.aqi == null ? undefined : bandVars(bandFor(item.aqi))}
            >
              <span>{item.name}</span>
              <span className="pg-flow-value">
                {item.aqi == null ? "No AQI, left out" : item.aqi}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="pg-flow-arrow">{Arrow}</div>
      <div className="pg-flow-out" style={bandVars(band)}>
        <p className="pg-flow-label">City AQI</p>
        <p className="pg-flow-number">{mean}</p>
        <p className="pg-flow-band">{band}</p>
        <p className="pg-flow-math">
          ({used.map((item) => item.aqi).join(" + ")}) ÷ {used.length}, rounded
        </p>
      </div>
    </figure>
  );
}

/** Official versus Estimate marks, drawn the way the history chart draws them. */
export function SeriesLegend() {
  return (
    <div className="pg-card pg-legend">
      <div className="pg-legend-item">
        <span className="pg-mark is-official" aria-hidden="true" />
        <div>
          <p className="pg-legend-name">Official</p>
          <p className="pg-legend-body">
            A reading CPCB published, saved as one value per day.
          </p>
        </div>
      </div>
      <div className="pg-legend-item">
        <span className="pg-mark is-estimate" aria-hidden="true" />
        <div>
          <p className="pg-legend-name">Estimate</p>
          <p className="pg-legend-body">
            A modelled daily value that covers days before Hawa&apos;s own records begin.
          </p>
        </div>
      </div>
    </div>
  );
}
