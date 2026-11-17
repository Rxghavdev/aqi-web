import { bandAccent, bandNumberColor, healthLine } from "@/lib/aqi";
import type { Band } from "@/lib/types";
import { aqiName, bandLabel, finiteAqi } from "./text";

export function AqiFigure({
  aqi,
  band,
  missing = "dash",
}: {
  aqi: number | null;
  band: Band | null;
  missing?: "dash" | "words";
}) {
  const value = finiteAqi(aqi);
  const accent = bandAccent(band);
  const numberColor = bandNumberColor(value == null ? null : band);
  const words = value == null && missing === "words";

  return (
    <div className="aqi-figure">
      <div className="aqi-bar" style={{ backgroundColor: accent }} aria-hidden="true" />
      <p className="band-word" style={{ color: accent }}>
        {bandLabel(band)}
      </p>
      <p className={words ? "aqi-missing" : "aqi-numeral"} style={{ color: numberColor }}>
        <span aria-hidden="true">{words ? "No official AQI" : (value ?? "—")}</span>
        <span className="sr-only">{aqiName(value, band)}</span>
      </p>
      <p className="health">
        {healthLine(value == null && missing === "words" ? null : band)}
      </p>
    </div>
  );
}
