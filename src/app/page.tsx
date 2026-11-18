import { Suspense } from "react";
import { AdSlot } from "@/components/ads/AdSlot";
import { HomeStage } from "@/components/place/HomeStage";
import { CityListFallback } from "@/components/reading/ReadingSkeleton";
import { ReadingLink } from "@/components/reading/ReadingLink";
import { cityPath, compareCities } from "@/components/reading/text";
import { listCities } from "@/lib/report";

export default function HomePage() {
  return (
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
      <div className="ad-slot-home">
        <AdSlot slot="home" />
      </div>
    </div>
  );
}
