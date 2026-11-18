import type { PlaceReport } from "@/lib/types";
import { stationPins } from "@/components/map/pins";
import { AqiFigure, HeroHead } from "@/components/reading/AqiFigure";
import { BandScale } from "@/components/reading/BandScale";
import { CityAverageLink } from "@/components/reading/CityAverageLink";
import { FactCard } from "@/components/reading/FactCard";
import { heroClass, heroStyle } from "@/components/reading/hero";
import { PollutantBoard } from "@/components/reading/PollutantBoard";
import { ReadingStage } from "@/components/reading/ReadingStage";
import { SpikeStrip } from "@/components/reading/SpikeStrip";
import { officialStation, pollutantLabel, stationPath } from "@/components/reading/text";
import { StationMap } from "@/components/map/StationMap";
import Link from "next/link";

/**
 * The reading for a saved point: official station number, the facts that
 * qualify it, the map, the pollutants behind it, and the history.
 */
export function PlaceReading({
  report,
  point,
  trend,
  search,
}: {
  report: PlaceReport;
  point: { lat: number; lon: number } | null;
  trend: React.ReactNode;
  search: React.ReactNode;
}) {
  const nearest = report.nearest;
  const official = nearest ? officialStation(nearest) : null;
  const distance =
    report.distanceKm != null && Number.isFinite(report.distanceKm)
      ? `${report.distanceKm.toFixed(1)} km`
      : "—";

  if (!nearest || !official) {
    return (
      <>
        <ReadingStage
          poster={
            <div className="hero is-quiet">
              <p className="kicker">Your nearest monitor</p>
              <h1 className="ask-title">No official number here yet.</h1>
              <p className="lede">
                CPCB did not publish enough pollutants at the closest station to
                set a National Air Quality Index.
              </p>
              {search}
            </div>
          }
          map={<StationMap pins={[]} user={point} />}
        />
        <SpikeStrip spike={report.spike} />
      </>
    );
  }

  return (
    <>
      <ReadingStage
        poster={
          <section className={heroClass(official.band)} style={heroStyle(official.band)}>
            <HeroHead
              kicker={`${nearest.city} · ${nearest.state}`}
              href={stationPath(nearest.slug)}
              title={nearest.name}
            />
            <AqiFigure
              aqi={official.aqi}
              band={official.band}
              updatedAt={nearest.updatedAt}
              missing="words"
            />
            <BandScale band={official.band} value={official.aqi} />
          </section>
        }
        facts={
          <FactCard
            facts={[
              { label: "Distance", value: distance },
              {
                label: "Set by",
                value: nearest.prominent ? pollutantLabel(nearest.prominent) : "—",
              },
              {
                label: "City average",
                value: report.city ? <CityAverageLink city={report.city} /> : "—",
              },
              {
                label: "Monitors nearby",
                value: `${report.stations.length}`,
              },
            ]}
            note={
              <>
                The nearest government monitor, not the air on your street.{" "}
                <Link className="fact-link" href={stationPath(nearest.slug)}>
                  Open the station
                </Link>
              </>
            }
          />
        }
        map={
          <StationMap
            pins={stationPins(report.stations)}
            activeSlug={nearest.slug}
            user={point}
            hereLabel="This city"
          />
        }
      />
      <section className="section">
        <div className="section-head">
          <h2 className="section-title">What sets this number</h2>
          <p className="section-sub">
            Open a tile to see what the pollutant is.
          </p>
        </div>
        <PollutantBoard pollutants={nearest.pollutants} />
        <p className="meters-note">These are index points, not concentrations.</p>
      </section>
      <SpikeStrip spike={report.spike} />
      {trend}
      <div className="search-again">{search}</div>
    </>
  );
}
