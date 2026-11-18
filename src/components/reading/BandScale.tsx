import { bandAccent } from "@/lib/aqi";
import type { Band } from "@/lib/types";

const BANDS: Array<{ band: Band; span: number; range: string }> = [
  { band: "Good", span: 50, range: "0–50" },
  { band: "Satisfactory", span: 50, range: "51–100" },
  { band: "Moderate", span: 100, range: "101–200" },
  { band: "Poor", span: 100, range: "201–300" },
  { band: "Very Poor", span: 100, range: "301–400" },
  { band: "Severe", span: 100, range: "401–500" },
];

/**
 * A flat version of the same scale, so a reader can place the number
 * without reading the gauge.
 */
export function BandScale({
  band,
  value,
}: {
  band: Band | null;
  value: number | null;
}) {
  const percent =
    value == null ? null : Math.min(100, Math.max(0, (value / 500) * 100));
  return (
    <div className="scale">
      <div className="scale-track" aria-hidden="true">
        {BANDS.map((entry) => (
          <span
            key={entry.band}
            className={
              entry.band === band ? "scale-seg is-active" : "scale-seg"
            }
            style={{ flexGrow: entry.span, background: bandAccent(entry.band) }}
          />
        ))}
        {percent != null ? (
          <span className="scale-mark" style={{ left: `${percent}%` }} />
        ) : null}
      </div>
      <div className="scale-legend" aria-hidden="true">
        <span>0</span>
        <span>100</span>
        <span>200</span>
        <span>300</span>
        <span>400</span>
        <span>500</span>
      </div>
    </div>
  );
}

/** The six bands with their index ranges; the current one is highlighted. */
export function BandLegend({ band }: { band: Band | null }) {
  return (
    <section className="legend" aria-label="India AQI scale">
      <h2 className="legend-title">India AQI scale</h2>
      <ul className="legend-list">
        {BANDS.map((entry) => (
          <li
            key={entry.band}
            className={
              entry.band === band ? "legend-row is-current" : "legend-row"
            }
            aria-current={entry.band === band ? "true" : undefined}
          >
            <span
              className="legend-swatch"
              style={{ background: bandAccent(entry.band) }}
              aria-hidden="true"
            />
            <span className="legend-name">{entry.band}</span>
            <span className="legend-range">{entry.range}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
