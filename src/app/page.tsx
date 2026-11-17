import { Suspense } from "react";
import Link from "next/link";
import { AdSlot } from "@/components/ads/AdSlot";
import { CityListFallback } from "@/components/reading/ReadingSkeleton";
import { ReadingLink } from "@/components/reading/ReadingLink";
import { PlaceSearch } from "@/components/search/PlaceSearch";
import { cityPath, compareCities } from "@/components/reading/text";
import { listCities } from "@/lib/report";

export default function HomePage() {
  return (
    <article>
      <h1 className="home-title">The official number, from the nearest station.</h1>
      <p className="home-lede">
        Other sites mix private sensors and the US scale. This page uses India&apos;s
        National Air Quality Index from CPCB monitors.
      </p>
      <PlaceSearch />
      <section className="mt-14" aria-labelledby="cities-heading">
        <h2 id="cities-heading" className="kicker">
          Cities, worst first
        </h2>
        <Suspense fallback={<CityListFallback />}>
          <CityIndex />
        </Suspense>
      </section>
      <aside className="aside-note">
        <p>The number is a 24-hour average.</p>
        <p>The worst pollutant sets the number.</p>
        <p>
          A city figure is the average of its stations.{" "}
          <Link href="/methodology" className="text-ink underline">
            Read the methodology.
          </Link>
        </p>
      </aside>
    </article>
  );
}

async function CityIndex() {
  const ranked = [...(await listCities())].sort(compareCities).slice(0, 12);
  return (
    <div>
      {ranked.length === 0 ? (
        <p className="empty-note">
          Station readings load on the server. Refresh in a moment.
        </p>
      ) : (
        <div className="rule-list">
          {ranked.map((city) => (
            <ReadingLink
              key={city.slug}
              href={cityPath(city.slug)}
              title={city.city}
              meta={city.state}
              aqi={city.aqi}
              band={city.band}
            />
          ))}
        </div>
      )}
      <div className="ad-slot-home"><AdSlot slot="home" /></div>
    </div>
  );
}
