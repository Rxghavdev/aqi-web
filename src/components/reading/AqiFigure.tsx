import Link from "next/link";
import type { Band } from "@/lib/types";
import { AqiDial } from "./AqiDial";
import { Atmosphere } from "./Atmosphere";
import {
  aqiName,
  bandLabel,
  bandNote,
  finiteAqi,
  formatStamp,
  stampIsToday,
} from "./text";

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
      <Atmosphere band={shown} />
      <AqiDial value={value} band={shown}>
        {words ? (
          <p className="aqi-missing">No AQI</p>
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

      {words ? null : (
        <p className="band-name">{bandLabel(shown ?? band)}</p>
      )}
      <p className="hook-line">{bandNote(shown)}</p>

      <p className="live-row">
        {live ? <span className="live-dot" aria-hidden="true" /> : null}
        <span>{live ? "Live" : "Updated"}</span>
        <span className="live-time">{stamp ?? "Time not published"}</span>
        {!live && stamp && value != null ? (
          <span className="live-note">
            Latest published reading. Updates hourly.
          </span>
        ) : null}
      </p>
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

/** Heading-free hero label, for pages whose title sits above the card. */
export function HeroLabel({ children }: { children: string }) {
  return (
    <header className="hero-head">
      <p className="hero-kicker">{children}</p>
    </header>
  );
}
