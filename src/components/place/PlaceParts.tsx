import type { ReactNode } from "react";
import type { Band, StationAqi } from "@/lib/types";
import { AqiFigure, HeroLabel } from "@/components/reading/AqiFigure";
import { BandScale } from "@/components/reading/BandScale";
import { heroClass, heroStyle } from "@/components/reading/hero";
import { PollutantBoard } from "@/components/reading/PollutantBoard";
import { meterRows } from "@/components/reading/pollutants";
import {
  finiteAqi,
  joinLabels,
  missingPollutants,
  officialStation,
} from "@/components/reading/text";
import { PlaceSection } from "./PlaceLayout";

/** The reading card for page layouts: label, dial, band, scale. */
export function PlaceHero({
  kicker,
  aqi,
  band,
  updatedAt,
  missing,
}: {
  kicker: string;
  aqi: number | null;
  band: Band | null;
  updatedAt: string | null;
  missing: "dash" | "words";
}) {
  const value = finiteAqi(aqi);
  const shown = value == null ? null : band;
  return (
    <section
      className={heroClass(shown)}
      style={heroStyle(shown)}
      aria-label={kicker}
    >
      <HeroLabel>{kicker}</HeroLabel>
      <AqiFigure
        aqi={value}
        band={shown}
        updatedAt={updatedAt}
        missing={missing}
      />
      <BandScale band={shown} value={value} />
    </section>
  );
}

/**
 * Pollutant tiles for one station. When the station has no AQI the tiles
 * still show whatever sub-indices were published, and one sentence names
 * what is missing.
 */
export function PollutantsSection({
  station,
  sub,
}: {
  station: StationAqi;
  sub?: ReactNode;
}) {
  const official = officialStation(station);
  const rows = meterRows(station.pollutants);
  const missing = missingPollutants(station.pollutants);
  const hasAqi = official.aqi != null;

  let body: ReactNode;
  if (rows.length === 0) {
    body = (
      <p className="empty-card">
        This station has not published any pollutant readings yet.
      </p>
    );
  } else {
    body = (
      <>
        {!hasAqi ? (
          <p className="empty-card">
            No AQI right now. CPCB needs at least three pollutants, including
            PM2.5 or PM10
            {missing.length > 0
              ? `, and this station is missing ${joinLabels(missing)}`
              : ""}
            .
          </p>
        ) : null}
        <PollutantBoard pollutants={station.pollutants} showSetter={hasAqi} />
      </>
    );
  }

  return (
    <PlaceSection
      id="pollutants"
      title="Pollutants"
      sub={
        sub ??
        (hasAqi
          ? "Each pollutant has its own sub-index on the 0–500 scale. The highest one sets the AQI."
          : "Sub-indices on the 0–500 scale, as published.")
      }
    >
      {body}
    </PlaceSection>
  );
}
