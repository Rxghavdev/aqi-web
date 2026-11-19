import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/ads/AdSlot";
import { StationMap } from "@/components/map/StationMap";
import { stationPins } from "@/components/map/pins";
import {
  PlaceHead,
  PlaceLayout,
  PlaceSection,
} from "@/components/place/PlaceLayout";
import { PlaceHero, PollutantsSection } from "@/components/place/PlaceParts";
import { BandLegend } from "@/components/reading/BandScale";
import { FactCard } from "@/components/reading/FactCard";
import { loadCity } from "@/components/reading/load";
import { NearbyCards } from "@/components/reading/NearbyCards";
import { StationRows } from "@/components/reading/StationRows";
import { WeatherCard } from "@/components/reading/WeatherCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { TrendChart } from "@/components/trend/TrendChart";
import {
  cityDescription,
  cityPath,
  cityTitle,
  finiteAqi,
  pollutantLabel,
  sortStations,
  stationPath,
} from "@/components/reading/text";
import { bandAccent } from "@/lib/aqi";
import { SITE_NAME, siteUrl } from "@/lib/site";
import type { CityAqi } from "@/lib/types";

type CityParams = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: CityParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadCity(slug);
  if (!result) notFound();
  return {
    title: cityTitle(result.city),
    description: cityDescription(result.city),
    alternates: { canonical: cityPath(result.city.slug) },
    openGraph: {
      title: cityTitle(result.city),
      description: cityDescription(result.city),
      url: cityPath(result.city.slug),
      type: "website",
    },
  };
}

export default async function CityPage({ params }: { params: CityParams }) {
  const { slug } = await params;
  // Resolve before rendering so an unknown slug answers 404 rather than
  // streaming a 200 shell with a not-found body.
  const result = await loadCity(slug);
  if (!result) notFound();
  return <CityReading result={result} />;
}

async function CityReading({
  result,
}: {
  result: NonNullable<Awaited<ReturnType<typeof loadCity>>>;
}) {
  const { city, stations, nearby } = result;
  const ordered = sortStations(stations);
  const [first] = ordered;
  const value = finiteAqi(city.aqi);
  const spread = spreadOf(ordered);
  const around = nearby
    .filter(
      (station) =>
        !(station.city === city.city && station.state === city.state),
    )
    .slice(0, 6);
  const count = stations.length;

  return (
    <>
      <JsonLd data={cityJsonLd(city)} />
      <PlaceLayout
        head={
          <PlaceHead
            crumbs={[
              { label: "Home", href: "/" },
              { label: city.state },
              { label: city.city },
            ]}
            title={city.city}
            sub={
              city.stationsReporting > 0
                ? `City average of ${city.stationsReporting} ${city.stationsReporting === 1 ? "station" : "stations"}`
                : "No stations reporting right now"
            }
            share={{
              title: `${city.city} air quality`,
              text:
                value != null
                  ? `${city.city} AQI is ${value}${city.band ? ` (${city.band})` : ""} right now.`
                  : `Air quality in ${city.city}.`,
              path: cityPath(city.slug),
            }}
          />
        }
        hero={
          <PlaceHero
            kicker="City AQI"
            aqi={value}
            band={city.band}
            updatedAt={city.updatedAt}
            missing="words"
          />
        }
        side={
          <>
            <FactCard
              facts={[
                {
                  label: "Stations reporting",
                  icon: "station",
                  value: `${city.stationsReporting} of ${city.stationsTotal}`,
                },
                {
                  label: "Set by",
                  icon: "pollutant",
                  value: city.prominent ? pollutantLabel(city.prominent) : "—",
                },
                {
                  label: "Highest station",
                  icon: "peak",
                  value:
                    first && finiteAqi(first.aqi) != null ? (
                      <Link
                        className="fact-link"
                        href={stationPath(first.slug)}
                      >
                        {first.name}
                      </Link>
                    ) : (
                      "—"
                    ),
                },
                {
                  label: "Spread",
                  icon: "spread",
                  value: spread ?? "—",
                },
              ]}
            />
            {first ? (
              <WeatherCard
                latitude={first.latitude}
                longitude={first.longitude}
              />
            ) : null}
            <BandLegend band={value == null ? null : city.band} />
          </>
        }
        map={
          <StationMap
            pins={stationPins(nearby)}
            activeSlug={first?.slug}
            hereLabel="This city"
          />
        }
      >
        {first ? (
          <PollutantsSection
            station={first}
            sub={`Readings at ${first.name}, the city's highest station. The highest sub-index at a station sets its AQI.`}
          />
        ) : null}
        <TrendChart
          kind="city"
          slug={city.slug}
          accent={bandAccent(city.band)}
        />
        <PlaceSection
          id="stations"
          title="Stations"
          sub={
            count > 0
              ? "Ranked by AQI, highest first. The city AQI is the average of the stations reporting."
              : undefined
          }
        >
          {count > 0 ? (
            <StationRows stations={ordered} />
          ) : (
            <p className="empty-card">
              No stations were published for this city. Check back in an hour.
            </p>
          )}
        </PlaceSection>
        <div className="ad-slot">
          <AdSlot slot="city" />
        </div>
        {around.length > 0 ? (
          <PlaceSection
            id="nearby"
            title="Nearby"
            sub="Stations around this city."
          >
            <NearbyCards stations={around} />
          </PlaceSection>
        ) : null}
      </PlaceLayout>
    </>
  );
}

function spreadOf(
  stations: Array<{ aqi: number | null; insufficient: boolean }>,
): string | null {
  const values = stations
    .filter((station) => !station.insufficient && station.aqi != null)
    .map((station) => station.aqi as number);
  if (values.length < 2) return null;
  const low = Math.min(...values);
  const high = Math.max(...values);
  return `${low}–${high}`;
}

function cityJsonLd(city: CityAqi): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: cityTitle(city),
    description: cityDescription(city),
    url: `${siteUrl()}${cityPath(city.slug)}`,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: siteUrl(),
    },
  };
}
