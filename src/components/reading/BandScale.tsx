import { bandAccent } from "@/lib/aqi";
import type { Band } from "@/lib/types";

const BANDS: Array<{ band: Band; span: number }> = [
  { band: "Good", span: 50 },
  { band: "Satisfactory", span: 50 },
  { band: "Moderate", span: 100 },
  { band: "Poor", span: 100 },
  { band: "Very Poor", span: 100 },
  { band: "Severe", span: 100 },
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
