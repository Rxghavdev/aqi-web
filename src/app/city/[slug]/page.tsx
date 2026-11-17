import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/ads/AdSlot";
import { AqiFigure } from "@/components/reading/AqiFigure";
import { loadCity } from "@/components/reading/load";
import { ReadingLink } from "@/components/reading/ReadingLink";
import { ReadingSkeleton } from "@/components/reading/ReadingSkeleton";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  cityDescription,
  cityPath,
  cityTitle,
  finiteAqi,
  sortStations,
  stationPath,
} from "@/components/reading/text";
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

  return (
    <article className="reading-layout">
      <JsonLd data={cityJsonLd(city)} />
      <div className="reading-summary">
        <h1 className="page-title">{city.city}</h1>
        <p className="lede">{city.state}</p>
        <div className="mt-8">
          <AqiFigure aqi={finiteAqi(city.aqi)} band={city.band} missing="dash" />
        </div>
        <p className="summary-note summary-lead">
          Average of {city.stationsReporting} of {city.stationsTotal} stations.
        </p>
        <p className="summary-note">
          CPCB averages the stations in a city. One monitor can be worse.
        </p>
        <p className="updated">
          {city.updatedAt ? `Updated ${city.updatedAt}` : "No update time was published with this reading."}
        </p>
      </div>
      <div className="reading-list">
        <h2 className="kicker">Stations</h2>
        {first ? (
          <div className="rule-list">
            <ReadingLink
              href={stationPath(first.slug)}
              title={first.name}
              aqi={first.aqi}
              band={first.band}
            />
            <div className="ad-slot"><AdSlot slot="city" /></div>
            {rest.map((station) => (
              <ReadingLink
                key={station.slug}
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
            <div className="ad-slot"><AdSlot slot="city" /></div>
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
