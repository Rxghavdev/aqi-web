import type { Metadata } from "next";
import { Callout, PageHeader, Section, Toc, type TocItem } from "@/components/pages/blocks";
import {
  BandChips,
  CityFlow,
  SeriesLegend,
  StationExample,
} from "@/components/pages/illustrations";
import { SITE_NAME } from "@/lib/site";

const LAST_UPDATED = "18 November 2026";

export const metadata: Metadata = {
  title: "Methodology",
  description: `How ${SITE_NAME} turns CPCB station readings into a station AQI, a city AQI and a daily history, and how often the data refreshes.`,
  alternates: { canonical: "/methodology" },
};

const SECTIONS: readonly TocItem[] = [
  { id: "scale", label: "The scale" },
  { id: "station", label: "Station AQI" },
  { id: "city", label: "City AQI" },
  { id: "estimate", label: "History and Estimate" },
  { id: "freshness", label: "Freshness" },
  { id: "source", label: "Source" },
];

export default function MethodologyPage() {
  return (
    <div className="pg">
      <PageHeader
        eyebrow="Methodology"
        title="How Hawa gets its numbers"
        lede="Every figure follows the CPCB National Air Quality Index. This page shows how a reading becomes a station AQI, a city AQI and a trend line."
        meta={`Last updated ${LAST_UPDATED}`}
      />

      <div className="pg-layout">
        <Toc items={SECTIONS} />

        <div className="pg-prose">
          <Section id="scale" title="The scale">
            <p>
              The National Air Quality Index runs from 0 to 500 and is split into six
              bands. The higher the number, the more polluted the air. Colours and
              wording on Hawa follow the band.
            </p>
            <BandChips />
            <p>
              The health line under each reading is general guidance for that band.
              For advice about your own health, ask your doctor.
            </p>
          </Section>

          <Section id="station" title="Station AQI">
            <p>
              A CPCB station measures up to eight pollutants: PM2.5, PM10, NO2, SO2,
              CO, ozone, NH3 and lead. Each one is turned into a sub-index on the same
              0 to 500 scale. The station AQI is the highest sub-index, and the
              pollutant behind it is the one that sets the number.
            </p>
            <StationExample />
            <p>
              A station gets an AQI only when at least three pollutants have a value,
              and at least one of them is PM2.5 or PM10. Otherwise the station shows
              no AQI.
            </p>
            <p>
              CPCB computes sub-indices from 24-hour averages. CO and ozone use 8-hour
              averages. A sudden spike therefore takes a few hours to show in the
              number.
            </p>
            <Callout title="Sub-indices are index points">
              The pollutant tiles on a station page show index points from 0 to 500.
              They are not concentrations in µg/m³.
            </Callout>
          </Section>

          <Section id="city" title="City AQI">
            <p>
              A city AQI is the mean of the AQIs of its stations, rounded to the
              nearest whole number. Only stations that have an AQI count. A station
              without enough pollutants is left out, and the city page says how many
              stations are reporting.
            </p>
            <CityFlow />
            <p>
              The city number is an average, so the worst station is often higher.
              City pages list every station, worst first.
            </p>
            <p>
              A station reading describes the air at that station, not on a particular
              street. When a page shows a distance, it is the distance to that
              station.
            </p>
          </Section>

          <Section id="estimate" title="History and Estimate">
            <p>
              Each city and station has a history chart. It draws two series, and they
              are never mixed into one number.
            </p>
            <SeriesLegend />
            <p>
              Official values are saved once a day for every place: the latest CPCB
              figure of that day, by India time. Hawa&apos;s own records start the day
              it first saw a place, so a new chart begins short.
            </p>
            <p>
              The Estimate series fills the days before that. It comes from the
              Open-Meteo air quality model: hourly PM2.5 at the place&apos;s
              position, averaged over each day and converted to the same 0 to 500
              scale with the CPCB PM2.5 breakpoints. It covers PM2.5 only, so it can
              sit below an Official value that another pollutant set.
            </p>
            <p>
              Station and city pages can also show a note that the air is rising this
              hour. It appears when the hourly model, using PM2.5 and PM10, is at
              least 50 points above the Official AQI. It is an Estimate and does not
              change the Official number.
            </p>
          </Section>

          <Section id="freshness" title="Freshness">
            <dl className="pg-facts">
              <div>
                <dt>Station readings</dt>
                <dd>CPCB publishes hourly. Each page shows the time of the latest reading, in IST.</dd>
              </div>
              <div>
                <dt>Hawa&apos;s copy</dt>
                <dd>Refreshed about every 30 minutes while the site is in use.</dd>
              </div>
              <div>
                <dt>Weather</dt>
                <dd>Current conditions from Open-Meteo, kept for up to 15 minutes.</dd>
              </div>
              <div>
                <dt>History</dt>
                <dd>One Official value per place per day. The Estimate series refreshes daily.</dd>
              </div>
            </dl>
            <p>
              If CPCB is running behind, the page says so and keeps showing the last
              reading it has.
            </p>
          </Section>

          <Section id="source" title="Source">
            <p className="pg-credit">
              Data: Central Pollution Control Board (CPCB) via data.gov.in
            </p>
            <p>
              Weather and the Estimate series come from{" "}
              <a href="https://open-meteo.com/">Open-Meteo</a>. To read about the
              index itself, see the{" "}
              <a href="https://airquality.cpcb.gov.in/AQI_India/">
                CPCB AQI pages
              </a>
              .
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
