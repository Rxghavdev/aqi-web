import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StationMap } from "@/components/map/StationMap";
import { stationPins } from "@/components/map/pins";
import {
  PlaceHead,
  PlaceLayout,
  PlaceSection,
} from "@/components/place/PlaceLayout";
import { PlaceHero, PollutantsSection } from "@/components/place/PlaceParts";
import { StationDistance } from "@/components/place/StationDistance";
import { BandLegend } from "@/components/reading/BandScale";
import { CityAverageLink } from "@/components/reading/CityAverageLink";
import { FactCard } from "@/components/reading/FactCard";
import { loadCity, loadStationPage } from "@/components/reading/load";
import { NearbyCards } from "@/components/reading/NearbyCards";
import { meterRows } from "@/components/reading/pollutants";
import { StationRows } from "@/components/reading/StationRows";
import { WeatherCard } from "@/components/reading/WeatherCard";
import { TrendChart } from "@/components/trend/TrendChart";
import {
  cityPath,
  officialStation,
  pollutantLabel,
  sortStations,
  stationDescription,
  stationPath,
  stationTitle,
} from "@/components/reading/text";
import { bandAccent } from "@/lib/aqi";

type StationParams = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: StationParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadStationPage(slug);
  if (!page) notFound();
  return {
    title: stationTitle(page.station),
    description: stationDescription(page.station),
    alternates: { canonical: stationPath(page.station.slug) },
    openGraph: {
      title: stationTitle(page.station),
      description: stationDescription(page.station),
      url: stationPath(page.station.slug),
      type: "website",
    },
  };
}

export default async function StationPage({
  params,
}: {
  params: StationParams;
}) {
  const { slug } = await params;
  // Resolve before rendering so an unknown slug answers 404, not a 200 shell.
  const page = await loadStationPage(slug);
  if (!page) notFound();
  return <StationReading page={page} />;
}

async function StationReading({
  page,
}: {
  page: NonNullable<Awaited<ReturnType<typeof loadStationPage>>>;
}) {
  const { station, city, nearby } = page;
  const official = officialStation(station);
  const others = nearby.filter((item) => item.slug !== station.slug);
  const cityPage = city ? await loadCity(city.slug) : null;
  const sameCity = sortStations(cityPage?.stations ?? []);
  const around = others
    .filter(
      (item) => !(item.city === station.city && item.state === station.state),
    )
    .slice(0, 6);
  const reported = meterRows(station.pollutants).length;

  return (
    <PlaceLayout
      head={
        <PlaceHead
          crumbs={[
            { label: "Home", href: "/" },
            { label: station.state },
            {
              label: station.city,
              href: city ? cityPath(city.slug) : undefined,
            },
          ]}
          title={station.name}
          sub={
            <>
              {station.city}, {station.state}
              <StationDistance
                latitude={station.latitude}
                longitude={station.longitude}
                prefix=" · "
              />
            </>
          }
          share={{
            title: `${station.name} air quality`,
            text:
              official.aqi != null
                ? `${station.name} AQI is ${official.aqi}${official.band ? ` (${official.band})` : ""} right now.`
                : `Air quality at ${station.name}.`,
            path: stationPath(station.slug),
          }}
        />
      }
      hero={
        <PlaceHero
          kicker="Station AQI"
          aqi={official.aqi}
          band={official.band}
          updatedAt={station.updatedAt}
          missing="words"
        />
      }
      side={
        <>
          <FactCard
            facts={[
              {
                label: "Set by",
                icon: "pollutant",
                value:
                  official.aqi != null && station.prominent
                    ? pollutantLabel(station.prominent)
                    : "—",
              },
              {
                label: "City average",
                icon: "city",
                value: city ? <CityAverageLink city={city} /> : "—",
              },
              {
                label: "Pollutants reported",
                icon: "layers",
                value: `${reported}`,
              },
              {
                label: city ? `Stations in ${city.city}` : "Stations in city",
                icon: "station",
                value: city ? `${city.stationsTotal}` : "—",
              },
            ]}
          />
          <WeatherCard
            latitude={station.latitude}
            longitude={station.longitude}
          />
          <BandLegend band={official.band} />
        </>
      }
      map={
        <StationMap
          pins={stationPins(nearby)}
          activeSlug={station.slug}
          hereLabel="Nearby"
        />
      }
    >
      <PollutantsSection station={station} />
      <TrendChart
        kind="station"
        slug={station.slug}
        accent={bandAccent(official.band)}
      />
      {sameCity.length > 1 ? (
        <PlaceSection
          id="stations"
          title={`Stations in ${station.city}`}
          sub="Ranked by AQI, highest first."
        >
          <StationRows stations={sameCity} activeSlug={station.slug} />
          {city ? (
            <p className="psec-link">
              <Link className="fact-link" href={cityPath(city.slug)}>
                {`See ${station.city} overview`}
              </Link>
            </p>
          ) : null}
        </PlaceSection>
      ) : null}
      {around.length > 0 ? (
        <PlaceSection
          id="nearby"
          title="Nearby"
          sub="Stations around this one."
        >
          <NearbyCards stations={around} />
        </PlaceSection>
      ) : null}
    </PlaceLayout>
  );
}
