import { Suspense } from "react";
import type { Metadata } from "next";
import { PlaceReading } from "@/components/place/PlaceReading";
import { PlaceSearch } from "@/components/search/PlaceSearch";
import { ReadingSkeleton } from "@/components/reading/ReadingSkeleton";
import { TrendChart } from "@/components/trend/TrendChart";
import { bandAccent } from "@/lib/aqi";
import { getPlace } from "@/lib/report";

export const metadata: Metadata = {
  title: "Air quality near you",
  description:
    "Live AQI for the station nearest to you, on India's National Air Quality Index.",
  // Coordinate URLs are unbounded. Canonicalise to the search page and keep
  // them out of the index.
  alternates: { canonical: "/near" },
  robots: { index: false, follow: true },
};

type NearSearch = Promise<{
  lat?: string | string[];
  lon?: string | string[];
}>;

export default function NearPage({
  searchParams,
}: {
  searchParams: NearSearch;
}) {
  return (
    <Suspense fallback={<ReadingSkeleton />}>
      <NearReading searchParams={searchParams} />
    </Suspense>
  );
}

async function NearReading({ searchParams }: { searchParams: NearSearch }) {
  const query = await searchParams;
  const lat = parseCoord(query.lat, -90, 90);
  const lon = parseCoord(query.lon, -180, 180);
  if (lat == null || lon == null) {
    return (
      <article className="reading">
        <EmptyNear
          title="Find the station nearest you."
          body="Use your location, or search for a city."
        />
      </article>
    );
  }

  const report = await getPlace({ lat, lon });
  if (!report) {
    return (
      <article className="reading">
        <EmptyNear
          title="No readings yet."
          body="We have no station readings for this location right now. Search for a city instead."
        />
      </article>
    );
  }

  const nearest = report.nearest;
  return (
    <PlaceReading
      variant="page"
      report={report}
      point={{ lat, lon }}
      search={<PlaceSearch />}
      trend={
        nearest ? (
          <TrendChart
            kind="station"
            slug={nearest.slug}
            accent={bandAccent(nearest.band)}
          />
        ) : null
      }
    />
  );
}

function EmptyNear({ title, body }: { title: string; body: string }) {
  return (
    <div className="ask-home">
      <div className="ask-copy">
        <p className="kicker">Nearest station</p>
        <h1 className="ask-title">{title}</h1>
        <p className="lede">{body}</p>
        <PlaceSearch />
      </div>
    </div>
  );
}

function parseCoord(
  value: string | string[] | undefined,
  min: number,
  max: number,
): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw == null) return null;
  const text = raw.trim().slice(0, 32);
  if (!text) return null;
  const number = Number(text);
  if (!Number.isFinite(number) || number < min || number > max) return null;
  return number;
}
