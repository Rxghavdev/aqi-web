import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AqiFigure } from "@/components/reading/AqiFigure";
import { SpikeStrip } from "@/components/reading/SpikeStrip";
import { ReadingSkeleton } from "@/components/reading/ReadingSkeleton";
import { PlaceSearch } from "@/components/search/PlaceSearch";
import { cityPath, officialStation, stationPath } from "@/components/reading/text";
import { getPlace } from "@/lib/report";
import type { CityAqi } from "@/lib/types";

export const metadata: Metadata = {
  title: "Nearest station",
  description:
    "The official National Air Quality Index from the CPCB station nearest to you.",
};

type NearSearch = Promise<{
  lat?: string | string[];
  lon?: string | string[];
}>;

export default function NearPage({ searchParams }: { searchParams: NearSearch }) {
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
      <article className="copy">
        <h1 className="page-title">Nearest station</h1>
        <p className="home-lede">Allow location, or search for a city.</p>
        <PlaceSearch />
      </article>
    );
  }

  const report = await getPlace({ lat, lon });
  if (!report) {
    return (
      <article className="copy">
        <h1 className="page-title">Nearest station</h1>
        <p className="lede">No CPCB reading is available for this location yet.</p>
        <PlaceSearch />
      </article>
    );
  }

  const nearest = report.nearest;
  const official = nearest ? officialStation(nearest) : null;

  return (
    <article className="max-w-3xl">
      {nearest && official ? (
        <>
          <h1 className="page-title">
            <Link href={stationPath(nearest.slug)} className="text-link">
              {nearest.name}
            </Link>
          </h1>
          <p className="lede">
            {nearest.city}, {nearest.state}
          </p>
          <div className="mt-8">
            <AqiFigure aqi={official.aqi} band={official.band} missing="words" />
          </div>
        </>
      ) : (
        <>
          <h1 className="page-title">Nearest station</h1>
          <p className="lede">No station was close enough to show an official number.</p>
        </>
      )}
      {report.distanceKm != null && Number.isFinite(report.distanceKm) ? (
        <p className="distance">{report.distanceKm.toFixed(1)} km from you</p>
      ) : null}
      {report.city ? <CityAverage city={report.city} /> : null}
      <SpikeStrip spike={report.spike} />
    </article>
  );
}

function CityAverage({ city }: { city: CityAqi }) {
  const value = city.aqi != null && Number.isFinite(city.aqi) ? String(city.aqi) : "—";
  const band = city.band ? `, ${city.band}` : "";
  return (
    <p className="city-average">
      <Link href={cityPath(city.slug)} className="text-link">
        City average {value}
        {band}
      </Link>
    </p>
  );
}

function parseCoord(
  value: string | string[] | undefined,
  min: number,
  max: number,
): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw == null) return null;
  const text = raw.trim();
  if (!text) return null;
  const number = Number(text);
  if (!Number.isFinite(number) || number < min || number > max) return null;
  return number;
}
