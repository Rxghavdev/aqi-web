import { hookLine } from "@/lib/voice";
import type { Band } from "@/lib/types";
import { aqiName, bandLabel, finiteAqi, formatStamp, stampIsToday } from "./text";

export function AqiFigure({
  aqi,
  band,
  updatedAt = null,
  missing = "dash",
}: {
  aqi: number | null;
  band: Band | null;
  updatedAt?: string | null;
  missing?: "dash" | "words";
}) {
  const value = finiteAqi(aqi);
  const shown = value == null ? null : band;
  const words = value == null && missing === "words";
  const stamp = formatStamp(updatedAt);
  const live = value != null && stampIsToday(updatedAt);

  return (
    <div className="aqi-figure">
      <p className={words ? "aqi-missing" : "aqi-numeral"}>
        <span aria-hidden="true">{words ? "No official AQI" : (value ?? "—")}</span>
        <span className="sr-only">{aqiName(value, shown)}</span>
      </p>
      <p className="band-name">{bandLabel(shown ?? (words ? null : band))}</p>
      <p className="hook-line">{hookLine(shown)}</p>
      <p className="live-row">
        {live ? <span className="live-dot" aria-hidden="true" /> : null}
        <span>{live ? "Live" : "Updated"}</span>
        <span className="live-time">
          {stamp ?? "No update time was published"}
        </span>
      </p>
      <p className="scale-line">CPCB National Air Quality Index</p>
    </div>
  );
}
