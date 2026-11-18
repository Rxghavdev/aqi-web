import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AqiFigure } from "@/components/reading/AqiFigure";
import { CityAverageLink } from "@/components/reading/CityAverageLink";
import { heroClass, heroStyle } from "@/components/reading/hero";
import { PollutantMeters, meterRows } from "@/components/reading/PollutantMeters";
import { ReadingSkeleton } from "@/components/reading/ReadingSkeleton";
import { SpikeStrip } from "@/components/reading/SpikeStrip";
import { PlaceSearch } from "@/components/search/PlaceSearch";
import { TrendChart } from "@/components/trend/TrendChart";
import { officialStation, pollutantLabel, stationPath } from "@/components/reading/text";
import { bandAccent } from "@/lib/aqi";
import { getPlace } from "@/lib/report";

export const metadata: Metadata = {
  title: "Nearest station",
  description:
    "The official National Air Quality Index from the CPCB station nearest to you.",
};

type NearSearch = Promise<{
  lat?: string | string[];
  lon?: string | string[];
}>;

export default function NearPage({ searchParams }: { searchParams: NearSearch }) {
  return (
    <Suspense fallback={<ReadingSkeleton />}>
      <NearReading searchParams={searchParams} />
    </Suspense>
  );
}

async function NearReading({ searchParams }: { searchParams: NearSearch }) {
  const query = await searchParams;
  const lat = parseCoord(query.lat, -90, 90);
  const lon = parseCoord(query.lon, -180, 180);
  if (lat == null || lon == null) {
    return (
      <article className="ask-home">
        <h1 className="ask-title">Nearest station</h1>
        <p className="lede">Allow location, or search for a city.</p>
        <PlaceSearch />
      </article>
    );
  }

  const report = await getPlace({ lat, lon });
  if (!report) {
    return (
      <article className="ask-home">
        <h1 className="ask-title">Nearest station</h1>
        <p className="lede">No CPCB reading is available for this location yet.</p>
        <PlaceSearch />
      </article>
    );
  }

  const nearest = report.nearest;
  const official = nearest ? officialStation(nearest) : null;
  const distance =
    report.distanceKm != null && Number.isFinite(report.distanceKm)
      ? `${report.distanceKm.toFixed(1)} km from you`
      : null;

  if (!nearest || !official) {
    return (
      <article className="reading">
        <section className="hero is-quiet">
          <h1 className="hero-place">Nearest station</h1>
          <p className="hook-line">No station was close enough to show an official number.</p>
          {distance ? <p className="hero-distance">{distance}</p> : null}
          {report.city ? <CityAverageLink city={report.city} /> : null}
        </section>
        <SpikeStrip spike={report.spike} />
      </article>
    );
  }

  const meters = meterRows(nearest.pollutants);

  return (
    <article className="reading">
      <div className="reading-top">
        <section className={heroClass(official.band)} style={heroStyle(official.band)}>
          <p className="hero-kicker">
            {nearest.city}
            <span aria-hidden="true"> · </span>
            {nearest.state}
          </p>
          <h1 className="hero-name">
            <Link href={stationPath(nearest.slug)}>{nearest.name}</Link>
          </h1>
          <AqiFigure
            aqi={official.aqi}
            band={official.band}
            updatedAt={nearest.updatedAt}
            missing="words"
          />
        </section>
        <div className="reading-side">
          <section className="paper-card">
            {distance ? <p className="hero-distance">{distance}</p> : null}
            {nearest.prominent ? <p>Set by {pollutantLabel(nearest.prominent)}</p> : null}
            {report.city ? <CityAverageLink city={report.city} /> : null}
          </section>
        </div>
      </div>
      {meters.length > 0 ? (
        <section className="paper-card">
          <PollutantMeters pollutants={nearest.pollutants} />
          <p className="meters-note">These are index points, not concentrations.</p>
        </section>
      ) : null}
      <SpikeStrip spike={report.spike} />
      <TrendChart kind="station" slug={nearest.slug} accent={bandAccent(official.band)} />
    </article>
  );
}

function parseCoord(
  value: string | string[] | undefined,
  min: number,
  max: number,
): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw == null) return null;
  const text = raw.trim();
  if (!text) return null;
  const number = Number(text);
  if (!Number.isFinite(number) || number < min || number > max) return null;
  return number;
}
