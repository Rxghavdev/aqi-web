import Link from "next/link";
import type { ReactNode } from "react";
import type { PlaceReport, StationAqi } from "@/lib/types";
import { stationPins } from "@/components/map/pins";
import { StationMap } from "@/components/map/StationMap";
import { AqiFigure, HeroHead } from "@/components/reading/AqiFigure";
import { BandLegend, BandScale } from "@/components/reading/BandScale";
import { CityAverageLink } from "@/components/reading/CityAverageLink";
import { FactCard } from "@/components/reading/FactCard";
import { heroClass, heroStyle } from "@/components/reading/hero";
import { NearbyCards } from "@/components/reading/NearbyCards";
import { ReadingStage } from "@/components/reading/ReadingStage";
import { SpikeStrip } from "@/components/reading/SpikeStrip";
import { StationRows } from "@/components/reading/StationRows";
import { WeatherCard } from "@/components/reading/WeatherCard";
import {
  cityPath,
  officialStation,
  pollutantLabel,
  sortStations,
  stationPath,
} from "@/components/reading/text";
import { PlaceHead, PlaceLayout, PlaceSection } from "./PlaceLayout";
import { PlaceHero, PollutantsSection } from "./PlaceParts";

type Point = { lat: number; lon: number } | null;

/**
 * The reading for a visitor's location: the nearest station's AQI, the facts
 * around it, the map, the pollutants behind it and the history.
 *
 * `home` keeps the compact homepage composition; `page` is the full place
 * page used by /near and follows the same rhythm as city and station pages.
 */
export function PlaceReading({
  report,
  point,
  trend,
  search,
  variant = "home",
}: {
  report: PlaceReport;
  point: Point;
  trend: ReactNode;
  search: ReactNode;
  variant?: "home" | "page";
}) {
  const nearest = report.nearest;

  if (!nearest) {
    return (
      <>
        <ReadingStage
          poster={
            <div className="hero is-quiet">
              <p className="kicker">Nearest station</p>
              <h1 className="ask-title">No station found nearby.</h1>
              <p className="lede">
                We could not find a station near this location. Search for a
                city instead.
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

  return variant === "page" ? (
    <NearPage
      report={report}
      nearest={nearest}
      point={point}
      trend={trend}
      search={search}
    />
  ) : (
    <HomeReading
      report={report}
      nearest={nearest}
      point={point}
      trend={trend}
      search={search}
    />
  );
}

function distanceText(report: PlaceReport): string | null {
  return report.distanceKm != null && Number.isFinite(report.distanceKm)
    ? `${report.distanceKm.toFixed(1)} km`
    : null;
}

function HomeReading({
  report,
  nearest,
  point,
  trend,
  search,
}: {
  report: PlaceReport;
  nearest: StationAqi;
  point: Point;
  trend: ReactNode;
  search: ReactNode;
}) {
  const official = officialStation(nearest);
  const distance = distanceText(report);

  return (
    <>
      <ReadingStage
        poster={
          <section
            className={heroClass(official.band)}
            style={heroStyle(official.band)}
          >
            <HeroHead
              kicker={
                distance
                  ? `Nearest station · ${distance} away`
                  : "Nearest station"
              }
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
          <>
            <FactCard
              facts={[
                {
                  label: "Distance",
                  icon: "route",
                  value: distance ?? "—",
                },
                {
                  label: "Set by",
                  icon: "pollutant",
                  value:
                    official.aqi != null && nearest.prominent
                      ? pollutantLabel(nearest.prominent)
                      : "—",
                },
                {
                  label: report.city
                    ? `${report.city.city} average`
                    : "City average",
                  icon: "city",
                  value: report.city ? (
                    <CityAverageLink city={report.city} />
                  ) : (
                    "—"
                  ),
                },
                {
                  label: "Stations in city",
                  icon: "station",
                  value: `${report.stations.length}`,
                },
              ]}
              note={
                <Link className="fact-link" href={stationPath(nearest.slug)}>
                  Open station page
                </Link>
              }
            />
            <WeatherCard
              latitude={nearest.latitude}
              longitude={nearest.longitude}
            />
          </>
        }
        map={
          <StationMap
            pins={stationPins(report.nearby)}
            activeSlug={nearest.slug}
            user={point}
            hereLabel="Nearby"
          />
        }
      />
      <PollutantsSection station={nearest} />
      <SpikeStrip spike={report.spike} />
      {trend}
      <div className="search-again">{search}</div>
    </>
  );
}

function NearPage({
  report,
  nearest,
  point,
  trend,
  search,
}: {
  report: PlaceReport;
  nearest: StationAqi;
  point: Point;
  trend: ReactNode;
  search: ReactNode;
}) {
  const official = officialStation(nearest);
  const distance = distanceText(report);
  const city = report.city;
  const inCity = sortStations(report.stations);
  const listed = new Set(inCity.map((station) => station.slug));
  const around = report.nearby
    .filter(
      (station) => !listed.has(station.slug) && station.slug !== nearest.slug,
    )
    .slice(0, 6);

  return (
    <PlaceLayout
      head={
        <PlaceHead
          crumbs={[
            { label: "Home", href: "/" },
            { label: nearest.state },
            {
              label: nearest.city,
              href: city ? cityPath(city.slug) : undefined,
            },
          ]}
          title={nearest.name}
          sub={
            distance ? `Nearest station · ${distance} away` : "Nearest station"
          }
          share={{
            title: `${nearest.name} air quality`,
            text:
              official.aqi != null
                ? `${nearest.name} AQI is ${official.aqi}${official.band ? ` (${official.band})` : ""} right now.`
                : `Air quality at ${nearest.name}.`,
            path: stationPath(nearest.slug),
          }}
        />
      }
      hero={
        <PlaceHero
          kicker="Station AQI"
          aqi={official.aqi}
          band={official.band}
          updatedAt={nearest.updatedAt}
          missing="words"
        />
      }
      side={
        <>
          <FactCard
            facts={[
              { label: "Distance", icon: "route", value: distance ?? "—" },
              {
                label: "Set by",
                icon: "pollutant",
                value:
                  official.aqi != null && nearest.prominent
                    ? pollutantLabel(nearest.prominent)
                    : "—",
              },
              {
                label: city ? `${city.city} average` : "City average",
                icon: "city",
                value: city ? <CityAverageLink city={city} /> : "—",
              },
              {
                label: "Stations in city",
                icon: "station",
                value: `${report.stations.length}`,
              },
            ]}
          />
          <WeatherCard
            latitude={nearest.latitude}
            longitude={nearest.longitude}
          />
          <BandLegend band={official.band} />
        </>
      }
      map={
        <StationMap
          pins={stationPins(report.nearby)}
          activeSlug={nearest.slug}
          user={point}
          hereLabel="Nearby"
        />
      }
    >
      <PollutantsSection station={nearest} />
      <SpikeStrip spike={report.spike} />
      {trend}
      {inCity.length > 1 ? (
        <PlaceSection
          id="stations"
          title={`Stations in ${nearest.city}`}
          sub="Ranked by AQI, highest first."
        >
          <StationRows stations={inCity} activeSlug={nearest.slug} />
        </PlaceSection>
      ) : null}
      {around.length > 0 ? (
        <PlaceSection id="nearby" title="Nearby" sub="Stations around you.">
          <NearbyCards stations={around} />
        </PlaceSection>
      ) : null}
      <div className="search-again">{search}</div>
    </PlaceLayout>
  );
}
