import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdSlot } from "@/components/ads/AdSlot";
import { HomeStage } from "@/components/place/HomeStage";
import { CityListFallback } from "@/components/reading/ReadingSkeleton";
import { ReadingLink } from "@/components/reading/ReadingLink";
import { cityPath, compareCities } from "@/components/reading/text";
import { JsonLd } from "@/components/seo/JsonLd";
import { listCities } from "@/lib/report";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME} — Live air quality across India` },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: `${SITE_NAME} — Live air quality across India`,
    description: SITE_DESCRIPTION,
    url: "/",
    type: "website",
  },
};

function websiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: siteUrl(),
    description: SITE_DESCRIPTION,
    inLanguage: "en-IN",
  };
}

export default function HomePage() {
  return (
    <>
      <JsonLd data={websiteJsonLd()} />
      <HomeStage
        ranking={
          <section id="cities" className="rank-panel" aria-labelledby="cities-heading">
            <h2 id="cities-heading" className="rank-title">
              Worst right now
            </h2>
            <Suspense fallback={<CityListFallback />}>
              <CityIndex />
            </Suspense>
          </section>
        }
      />
    </>
  );
}

async function CityIndex() {
  const all = await listCities();
  const ranked = [...all].sort(compareCities).slice(0, 12);
  return (
    <div>
      {ranked.length === 0 ? (
        <p className="empty-note">
          City readings are loading. Check back in a minute.
        </p>
      ) : (
        <div className="rank-list">
          {ranked.map((city, index) => (
            <ReadingLink
              key={city.slug}
              rank={index + 1}
              href={cityPath(city.slug)}
              title={city.city}
              meta={city.state}
              aqi={city.aqi}
              band={city.band}
            />
          ))}
        </div>
      )}
      {all.length > ranked.length ? (
        <Link href="/cities" className="pg-more">
          <span>All {all.length} cities</span>
          <svg
            aria-hidden="true"
            focusable="false"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      ) : null}
      <div className="ad-slot-home">
        <AdSlot slot="home" />
      </div>
    </div>
  );
}
