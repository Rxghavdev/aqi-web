import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CitiesBrowser } from "@/components/cities/CitiesBrowser";
import { groupByState } from "@/components/cities/group";
import { PageHeader } from "@/components/pages/blocks";
import {
  bandLabel,
  cityPath,
  compareCities,
  finiteAqi,
} from "@/components/reading/text";
import { bandAccent, bandNumberColor, bandTextColor } from "@/lib/aqi";
import { listCities } from "@/lib/report";
import type { CityAqi } from "@/lib/types";

export const metadata: Metadata = {
  title: "All cities",
  description:
    "Live AQI for every Indian city with CPCB stations, grouped by state. Find your city and compare it with the rest of India.",
  alternates: { canonical: "/cities" },
  openGraph: {
    title: "All cities",
    description:
      "Live AQI for every Indian city with CPCB stations, grouped by state.",
    url: "/cities",
    type: "website",
  },
};

export default function CitiesPage() {
  return (
    <div className="pg pg-cities">
      <PageHeader
        eyebrow="Cities"
        title="All cities"
        lede="Every city with CPCB stations, grouped by state. Tap a city for its stations, pollutants and history."
      />
      <Suspense fallback={<CitiesFallback />}>
        <CitiesBody />
      </Suspense>
    </div>
  );
}

async function CitiesBody() {
  const cities = await listCities();
  if (cities.length === 0) {
    return (
      <div className="cities-empty" role="status">
        <p className="cities-empty-title">City readings are loading.</p>
        <p className="cities-empty-body">Check back in a minute.</p>
      </div>
    );
  }

  const groups = groupByState(cities);
  const ranked = cities.filter((city) => finiteAqi(city.aqi) != null).sort(compareCities);
  const worst = ranked[0] ?? null;
  const lowest = ranked.length > 0 ? finiteAqi(ranked[ranked.length - 1].aqi) : null;
  const best =
    ranked
      .filter((city) => finiteAqi(city.aqi) === lowest)
      .sort((a, b) => a.city.localeCompare(b.city))[0] ?? null;

  return (
    <>
      <section className="cities-summary" aria-label="Summary">
        <div className="cities-stat">
          <p className="cities-stat-label">Cities</p>
          <p className="cities-stat-value">{cities.length}</p>
          <p className="cities-stat-meta">
            Across {groups.length} states and territories
          </p>
        </div>
        <ExtremeTile label="Best right now" city={best} />
        <ExtremeTile label="Worst right now" city={worst} />
      </section>
      <CitiesBrowser groups={groups} />
    </>
  );
}

function ExtremeTile({ label, city }: { label: string; city: CityAqi | null }) {
  if (!city) {
    return (
      <div className="cities-stat">
        <p className="cities-stat-label">{label}</p>
        <p className="cities-stat-value">—</p>
      </div>
    );
  }
  const style = {
    "--accent": bandAccent(city.band),
    "--band-num": bandNumberColor(city.band),
    "--band-text": bandTextColor(city.band),
  } as CSSProperties;
  return (
    <Link href={cityPath(city.slug)} className="cities-stat is-link" style={style}>
      <p className="cities-stat-label">{label}</p>
      <p className="cities-stat-name">{city.city}</p>
      <p className="cities-stat-meta">{city.state}</p>
      <p className="cities-stat-aqi">
        <span className="cities-stat-num">
          <span className="sr-only">AQI </span>
          {finiteAqi(city.aqi)}
        </span>
        <span className="cities-stat-band">{bandLabel(city.band)}</span>
      </p>
    </Link>
  );
}

function CitiesFallback() {
  return (
    <div className="pg-skel" aria-busy="true">
      <p className="sr-only">Loading cities.</p>
      <div className="pg-skel-strip" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="pg-skel-bar" aria-hidden="true" />
      <div className="pg-skel-rows" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
    </div>
  );
}
