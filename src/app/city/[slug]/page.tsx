import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/ads/AdSlot";
import { AqiFigure } from "@/components/reading/AqiFigure";
import { heroClass, heroStyle } from "@/components/reading/hero";
import { loadCity } from "@/components/reading/load";
import { meterRows, PollutantMeters } from "@/components/reading/PollutantMeters";
import { ReadingLink } from "@/components/reading/ReadingLink";
import { ReadingSkeleton } from "@/components/reading/ReadingSkeleton";
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
  const { city, stations } = result;
  const ordered = sortStations(stations);
  const [first, ...rest] = ordered;
  const meters = first ? meterRows(first.pollutants) : [];

  return (
    <article className="desk">
      <JsonLd data={cityJsonLd(city)} />
      <div className="desk-main">
        <div className="reading-top">
          <section className={heroClass(city.band)} style={heroStyle(city.band)}>
            <p className="hero-kicker">{city.state}</p>
            <h1 className="hero-name">{city.city}</h1>
            <AqiFigure
              aqi={finiteAqi(city.aqi)}
              band={city.band}
              updatedAt={city.updatedAt}
              missing="dash"
            />
          </section>
          <div className="reading-side">
            <section className="paper-card">
              <p>
                Average of {city.stationsReporting} of {city.stationsTotal} stations.
              </p>
              <p>CPCB averages the stations in a city. One monitor can be worse.</p>
              {city.prominent ? <p>Set by {pollutantLabel(city.prominent)}</p> : null}
              {first ? (
                <p className="fact-row">
                  <Link className="fact-link" href={stationPath(first.slug)}>
                    Worst monitor: {first.name}
                  </Link>
                </p>
              ) : null}
            </section>
          </div>
        </div>
        {first && meters.length > 0 ? (
          <section className="paper-card">
            <p className="meters-source">From the worst monitor</p>
            <PollutantMeters pollutants={first.pollutants} />
            <p className="meters-note">These are index points, not concentrations.</p>
          </section>
        ) : null}
        <TrendChart kind="city" slug={city.slug} accent={bandAccent(city.band)} />
      </div>
      <div className="rank-panel">
        <h2 className="rank-title">Stations</h2>
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
