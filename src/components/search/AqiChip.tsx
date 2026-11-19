import type { CSSProperties } from "react";
import { bandAccent, bandTextColor } from "@/lib/aqi";
import type { Band } from "@/lib/types";
import { bandLabel } from "@/components/reading/text";

/** AQI value on a tint of its band colour. The band is also in text. */
export function AqiChip({ aqi, band }: { aqi: number | null; band: Band | null }) {
  const style =
    aqi == null
      ? undefined
      : ({
          "--chip-accent": bandAccent(band),
          "--chip-text": bandTextColor(band),
        } as CSSProperties);
  return (
    <span className={aqi == null ? "aqi-chip is-empty" : "aqi-chip"} style={style}>
      <span className="aqi-chip-value">{aqi ?? "—"}</span>
      <span className="sr-only">{aqi == null ? "No reading" : bandLabel(band)}</span>
    </span>
  );
}
