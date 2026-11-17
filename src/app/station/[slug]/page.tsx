import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AqiFigure } from "@/components/reading/AqiFigure";
import { loadStation } from "@/components/reading/load";
import { ReadingSkeleton } from "@/components/reading/ReadingSkeleton";
import {
  mapHref,
  officialStation,
  pollutantLabel,
  stationDescription,
  stationTitle,
} from "@/components/reading/text";

type StationParams = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: StationParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const station = await loadStation(slug);
  if (!station) notFound();
  return {
    title: stationTitle(station),
    description: stationDescription(station),
  };
}

export default function StationPage({ params }: { params: StationParams }) {
  return (
    <Suspense fallback={<ReadingSkeleton />}>
      <StationReading params={params} />
    </Suspense>
  );
}

async function StationReading({ params }: { params: StationParams }) {
  const { slug } = await params;
  const station = await loadStation(slug);
  if (!station) notFound();
  const official = officialStation(station);

  return (
    <article className="reading-layout">
      <div className="reading-summary">
        <h1 className="page-title">{station.name}</h1>
        <p className="lede">
          {station.city}, {station.state}
        </p>
        <div className="mt-8">
          <AqiFigure aqi={official.aqi} band={official.band} missing="words" />
        </div>
        {station.prominent ? (
          <p className="summary-note summary-lead">
            Set by {pollutantLabel(station.prominent)}
          </p>
        ) : null}
        <p className="updated">
          {station.updatedAt
            ? `Updated ${station.updatedAt}`
            : "No update time was published with this reading."}
        </p>
        <p className="mt-6">
          <a
            className="text-link"
            href={mapHref(station.latitude, station.longitude)}
            target="_blank"
            rel="noreferrer"
          >
            Open the station on a map
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      </div>
      <div className="reading-list">
        <h2 className="kicker">Sub-index</h2>
        <p className="summary-note">These are index points, not concentrations.</p>
        {station.pollutants.length === 0 ? (
          <p className="empty-note">No sub-indices were published for this station.</p>
        ) : (
          <dl className="subindex">
            {station.pollutants.map((reading) => (
              <div key={reading.id}>
                <dt>{pollutantLabel(reading.id)}</dt>
                <dd>{reading.subIndex ?? "—"}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </article>
  );
}
