import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StationMap } from "@/components/map/StationMap";
import { stationPins } from "@/components/map/pins";
import { StationDistance } from "@/components/place/StationDistance";
import { AqiFigure, HeroHead } from "@/components/reading/AqiFigure";
import { BandScale } from "@/components/reading/BandScale";
import { CityAverageLink } from "@/components/reading/CityAverageLink";
import { FactCard } from "@/components/reading/FactCard";
import { heroClass, heroStyle } from "@/components/reading/hero";
import { loadStationPage } from "@/components/reading/load";
import { PollutantBoard } from "@/components/reading/PollutantBoard";
import { ReadingStage } from "@/components/reading/ReadingStage";
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
  const { station, city, nearby } = page;
  const official = officialStation(station);

  return (
    <article className="reading">
      <ReadingStage
        poster={
          <section className={heroClass(official.band)} style={heroStyle(official.band)}>
            <HeroHead
              kicker={`${station.city} · ${station.state}`}
              title={station.name}
            />
            <AqiFigure
              aqi={official.aqi}
              band={official.band}
              updatedAt={station.updatedAt}
              missing="words"
            />
            <BandScale band={official.band} value={official.aqi} />
          </section>
        }
        facts={
          <FactCard
            facts={[
              {
                label: "Set by",
                value: station.prominent ? pollutantLabel(station.prominent) : "—",
              },
              {
                label: "City average",
                value: city ? <CityAverageLink city={city} /> : "—",
              },
            ]}
          >
            <StationDistance
              latitude={station.latitude}
              longitude={station.longitude}
            />
          </FactCard>
        }
        map={
          <StationMap
            pins={stationPins(nearby)}
            activeSlug={station.slug}
            hereLabel="Nearby"
          />
        }
      />

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">What this monitor reports</h2>
          <p className="section-sub">
            One tile per pollutant. The worst sub-index is the station number.
          </p>
        </div>
        {official.aqi != null ? (
          <>
            <PollutantBoard pollutants={station.pollutants} />
            <p className="meters-note">These are index points, not concentrations.</p>
          </>
        ) : (
          <p className="empty-note">
            CPCB did not publish enough pollutants here to set a number. The
            agency needs at least three, including PM2.5 or PM10.
          </p>
        )}
      </section>

      <TrendChart kind="station" slug={station.slug} accent={bandAccent(official.band)} />
    </article>
  );
}
