import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StationDistance } from "@/components/place/StationDistance";
import { AqiFigure } from "@/components/reading/AqiFigure";
import { CityAverageLink } from "@/components/reading/CityAverageLink";
import { heroClass, heroStyle } from "@/components/reading/hero";
import { loadStationPage } from "@/components/reading/load";
import { meterRows, PollutantMeters } from "@/components/reading/PollutantMeters";
import { ReadingSkeleton } from "@/components/reading/ReadingSkeleton";
import { TrendChart } from "@/components/trend/TrendChart";
import {
  officialStation,
  pollutantLabel,
  stationDescription,
  stationTitle,
} from "@/components/reading/text";
import { bandAccent } from "@/lib/aqi";

type StationParams = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: StationParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadStationPage(slug);
  if (!page) notFound();
  return {
    title: stationTitle(page.station),
    description: stationDescription(page.station),
  };
}

export default function StationPage({ params }: { params: StationParams }) {
  return (
    <Suspense fallback={<ReadingSkeleton />}>
      <StationReading params={params} />
    </Suspense>
  );
}

async function StationReading({ params }: { params: StationParams }) {
  const { slug } = await params;
  const page = await loadStationPage(slug);
  if (!page) notFound();
  const { station, city } = page;
  const official = officialStation(station);
  const meters = meterRows(station.pollutants);

  return (
    <article className="reading">
      <div className="reading-top">
        <section className={heroClass(official.band)} style={heroStyle(official.band)}>
          <p className="hero-kicker">
            {station.city}
            <span aria-hidden="true"> · </span>
            {station.state}
          </p>
          <h1 className="hero-name">{station.name}</h1>
          <AqiFigure
            aqi={official.aqi}
            band={official.band}
            updatedAt={station.updatedAt}
            missing="words"
          />
        </section>
        <div className="reading-side">
          <section className="paper-card">
            <StationDistance latitude={station.latitude} longitude={station.longitude} />
            {station.prominent ? <p>Set by {pollutantLabel(station.prominent)}</p> : null}
            {city ? <CityAverageLink city={city} /> : null}
          </section>
        </div>
      </div>
      <section className="paper-card">
        {meters.length > 0 ? (
          <>
            <PollutantMeters pollutants={station.pollutants} />
            <p className="meters-note">These are index points, not concentrations.</p>
          </>
        ) : (
          <p>No sub-indices were published for this station.</p>
        )}
      </section>
      <TrendChart kind="station" slug={station.slug} accent={bandAccent(official.band)} />
    </article>
  );
}
