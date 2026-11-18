import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/ads/AdSlot";
import { StationMap } from "@/components/map/StationMap";
import { stationPins } from "@/components/map/pins";
import { AqiFigure, HeroHead } from "@/components/reading/AqiFigure";
import { BandScale } from "@/components/reading/BandScale";
import { FactCard } from "@/components/reading/FactCard";
import { heroClass, heroStyle } from "@/components/reading/hero";
import { loadCity } from "@/components/reading/load";
import { PollutantBoard } from "@/components/reading/PollutantBoard";
import { ReadingLink } from "@/components/reading/ReadingLink";
import { ReadingStage } from "@/components/reading/ReadingStage";
import { ReadingSkeleton } from "@/components/reading/ReadingSkeleton";
import { WeatherCard } from "@/components/reading/WeatherCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { TrendChart } from "@/components/trend/TrendChart";
import {
  cityDescription,
  cityPath,
  cityTitle,
  finiteAqi,
  pollutantLabel,
  sortStations,
  stationPath,
} from "@/components/reading/text";
import { bandAccent } from "@/lib/aqi";
import { SITE_NAME, siteUrl } from "@/lib/site";
import type { CityAqi } from "@/lib/types";

type CityParams = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: CityParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadCity(slug);
  if (!result) notFound();
  return {
    title: cityTitle(result.city),
    description: cityDescription(result.city),
  };
}

export default function CityPage({ params }: { params: CityParams }) {
  return (
    <Suspense fallback={<ReadingSkeleton />}>
      <CityReading params={params} />
    </Suspense>
  );
}

async function CityReading({ params }: { params: CityParams }) {
  const { slug } = await params;
  const result = await loadCity(slug);
  if (!result) notFound();
  const { city, stations, nearby } = result;
  const ordered = sortStations(stations);
  const [first, ...rest] = ordered;
  const value = finiteAqi(city.aqi);
  const spread = spreadOf(ordered);

  return (
    <article className="desk">
      <JsonLd data={cityJsonLd(city)} />
      <div className="desk-main">
        <ReadingStage
          poster={
            <section className={heroClass(city.band)} style={heroStyle(city.band)}>
              <HeroHead kicker={city.state} title={city.city} />
              <AqiFigure
                aqi={value}
                band={city.band}
                updatedAt={city.updatedAt}
                missing="dash"
              />
              <BandScale band={city.band} value={value} />
            </section>
          }
          facts={
            <FactCard
              facts={[
                {
                  label: "Stations",
                  value: `${city.stationsReporting} of ${city.stationsTotal} reporting`,
                },
                {
                  label: "Set by",
                  value: city.prominent ? pollutantLabel(city.prominent) : "—",
                },
                {
                  label: "Worst monitor",
                  value: first ? (
                    <Link className="fact-link" href={stationPath(first.slug)}>
                      {first.name}
                    </Link>
                  ) : (
                    "—"
                  ),
                },
                {
                  label: "Spread",
                  value: spread ? `${spread}` : "—",
                },
              ]}
              note="CPCB averages the stations in a city. One monitor can be worse than the average."
            >
              {first ? (
                <WeatherCard latitude={first.latitude} longitude={first.longitude} />
              ) : null}
            </FactCard>
          }
          map={
            <StationMap
              pins={stationPins(nearby)}
              activeSlug={first?.slug}
              hereLabel="This city"
            />
          }
        />
        {first ? (
          <section className="section">
            <div className="section-head">
              <h2 className="section-title">Inside the worst monitor</h2>
              <p className="section-sub">
                {first.name}. Open a tile for what the pollutant is.
              </p>
            </div>
            <PollutantBoard pollutants={first.pollutants} />
            <p className="meters-note">These are index points, not concentrations.</p>
          </section>
        ) : null}
        <TrendChart kind="city" slug={city.slug} accent={bandAccent(city.band)} />
      </div>
      <div className="rank-panel">
        <div className="section-head">
          <h2 className="rank-title">Stations</h2>
          <p className="section-sub">Worst first. Ties go alphabetically.</p>
        </div>
        {first ? (
          <div className="rank-list">
            <ReadingLink
              rank={1}
              href={stationPath(first.slug)}
              title={first.name}
              aqi={first.aqi}
              band={first.band}
            />
            <div className="ad-slot">
              <AdSlot slot="city" />
            </div>
            {rest.map((station, index) => (
              <ReadingLink
                key={station.slug}
                rank={index + 2}
                href={stationPath(station.slug)}
                title={station.name}
                aqi={station.aqi}
                band={station.band}
              />
            ))}
          </div>
        ) : (
          <>
            <p className="empty-note">No stations were published for this city.</p>
            <div className="ad-slot">
              <AdSlot slot="city" />
            </div>
          </>
        )}
      </div>
    </article>
  );
}

function spreadOf(stations: Array<{ aqi: number | null; insufficient: boolean }>): string | null {
  const values = stations
    .filter((station) => !station.insufficient && station.aqi != null)
    .map((station) => station.aqi as number);
  if (values.length < 2) return null;
  const low = Math.min(...values);
  const high = Math.max(...values);
  return `${low}–${high}`;
}

function cityJsonLd(city: CityAqi): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: cityTitle(city),
    description: cityDescription(city),
    url: `${siteUrl()}${cityPath(city.slug)}`,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: siteUrl(),
    },
  };
}
