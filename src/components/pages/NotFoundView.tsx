import Link from "next/link";
import { Suspense } from "react";
import { PlaceSearch } from "@/components/search/PlaceSearch";
import { bandNumberColor, bandTextColor } from "@/lib/aqi";
import { listCities } from "@/lib/report";
import { bandLabel, cityPath, compareCities, finiteAqi } from "@/components/reading/text";
import { PageHeader } from "./blocks";

/**
 * One layout for every 404: what happened, a way to find the right page
 * (search), and three useful destinations.
 */
export function NotFoundView({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede: string;
}) {
  return (
    <div className="pg pg-lost">
      <PageHeader eyebrow={eyebrow} title={title} lede={lede} />
      <div className="pg-lost-search">
        <p className="pg-lost-label">Search for it</p>
        <PlaceSearch />
      </div>
      <nav className="pg-lost-links" aria-label="Other places to go">
        <Link href="/" className="pg-lost-link">
          <span className="pg-lost-link-title">Home</span>
          <span className="pg-lost-link-body">Find your place and see the map.</span>
        </Link>
        <Link href="/cities" className="pg-lost-link">
          <span className="pg-lost-link-title">All cities</span>
          <span className="pg-lost-link-body">Every city, grouped by state.</span>
        </Link>
        <Suspense fallback={<div className="pg-lost-link is-pending" aria-hidden="true" />}>
          <WorstNow />
        </Suspense>
      </nav>
    </div>
  );
}

async function WorstNow() {
  const worst = [...(await listCities())]
    .filter((city) => finiteAqi(city.aqi) != null)
    .sort(compareCities)[0];
  if (!worst) return null;
  const aqi = finiteAqi(worst.aqi);
  return (
    <Link href={cityPath(worst.slug)} className="pg-lost-link">
      <span className="pg-lost-link-title">Worst right now</span>
      <span className="pg-lost-link-body">
        {worst.city}, {worst.state}
      </span>
      <span className="pg-lost-link-aqi">
        <span style={{ color: bandNumberColor(worst.band) }}>
          <span className="sr-only">AQI </span>
          {aqi}
        </span>
        <span style={{ color: bandTextColor(worst.band) }}>{bandLabel(worst.band)}</span>
      </span>
    </Link>
  );
}
