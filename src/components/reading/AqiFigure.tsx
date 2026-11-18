import Link from "next/link";
import { hookLine } from "@/lib/voice";
import type { Band } from "@/lib/types";
import { AqiDial } from "./AqiDial";
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
      <AqiDial value={value} band={shown}>
        {words ? (
          <p className="aqi-missing">No official AQI</p>
        ) : (
          <>
            <p className="aqi-numeral">
              <span aria-hidden="true">{value ?? "—"}</span>
              <span className="sr-only">{aqiName(value, shown)}</span>
            </p>
            <p className="dial-unit">India scale · 0–500</p>
          </>
        )}
      </AqiDial>

      <p className="band-name">{bandLabel(shown ?? (words ? null : band))}</p>
      <p className="hook-line">{hookLine(shown)}</p>

      <p className="live-row">
        {live ? <span className="live-dot" aria-hidden="true" /> : null}
        <span>{live ? "Live" : "Updated"}</span>
        <span className="live-time">{stamp ?? "No update time was published"}</span>
        {!live && stamp ? (
          <span className="live-note">Official feed is behind; it refreshes hourly.</span>
        ) : null}
      </p>
      <p className="scale-line">CPCB National Air Quality Index</p>
    </div>
  );
}

export function HeroHead({
  kicker,
  href,
  title,
}: {
  kicker: string;
  href?: string;
  title: string;
}) {
  return (
    <header className="hero-head">
      <p className="hero-kicker">{kicker}</p>
      <h1 className="hero-name">
        {href ? <Link href={href}>{title}</Link> : title}
      </h1>
    </header>
  );
}
