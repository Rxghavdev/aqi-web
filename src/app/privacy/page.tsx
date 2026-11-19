import type { Metadata } from "next";
import { Callout, PageHeader, Section } from "@/components/pages/blocks";
import { ContactLink, contactEmail } from "@/components/pages/contact";
import { SITE_NAME } from "@/lib/site";

const LAST_UPDATED = "18 November 2026";

export const metadata: Metadata = {
  title: "Privacy",
  description: `What ${SITE_NAME} does with your location, your searches and your settings. No accounts, and nothing about you is stored on our servers.`,
  alternates: { canonical: "/privacy" },
};

/** Ads load only when a client id and at least one slot id are configured. */
function adsEnabled(): boolean {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim();
  const home = process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME?.trim();
  const city = process.env.NEXT_PUBLIC_ADSENSE_SLOT_CITY?.trim();
  return Boolean(client && (home || city));
}

export default function PrivacyPage() {
  const email = contactEmail();
  const ads = adsEnabled();
  return (
    <div className="pg">
      <PageHeader
        eyebrow="Privacy"
        title="Privacy, in plain words."
        lede={`${SITE_NAME} has no accounts and keeps no profile of you. Here is what happens to your location, your searches and your settings.`}
        meta={`Last updated ${LAST_UPDATED}`}
      />

      <div className="pg-prose">
        <Callout title="The short version">
          No accounts. No tracking profile. Your location is used to find the
          nearest station and is not stored on our servers.
        </Callout>

        <Section id="location" title="Your location">
          <p>
            {SITE_NAME} asks for your location only when you choose Use my location.
            Your browser asks for permission first. If you say no, search for a city
            or station by name instead.
          </p>
          <p>
            If you allow it, your coordinates, rounded to four decimals (about 10
            metres), go to our server in the request that finds the nearest station.
            The server uses them for that lookup and does not store them. Weather and
            the hourly estimate are looked up for the station&apos;s position, never
            yours.
          </p>
          <p>
            Your browser keeps a copy in local storage so your station is ready next
            time. The nearest-station page address also contains your coordinates, so
            it appears in your browser history. Clear your site data to remove both.
          </p>
        </Section>

        <Section id="searches" title="Your searches">
          <p>
            What you type in the search box is sent to our server to find matching
            cities and stations. Searches are not stored and are not linked to you.
          </p>
        </Section>

        <Section id="device" title="On your device">
          <p>{SITE_NAME} saves two things in your browser&apos;s local storage:</p>
          <ul className="pg-list">
            <li>Your last location, or a note that you skipped the location prompt.</li>
            <li>Your theme choice, light or dark.</li>
          </ul>
          <p>
            Both are stored only in your browser.{" "}
            {ads
              ? `${SITE_NAME} sets no cookies of its own.`
              : `${SITE_NAME} sets no cookies.`}
          </p>
        </Section>

        <Section id="services" title="Other services">
          <p>
            Weather and the Estimate series come from{" "}
            <a href="https://open-meteo.com/">Open-Meteo</a>, requested by our server
            for a station&apos;s position. The map loads from OpenFreeMap, so your
            browser contacts it directly, as with any hosted map.
          </p>
        </Section>

        {ads ? (
          <Section id="ads" title="Ads">
            <p>
              {SITE_NAME} shows ads through Google AdSense. Google may set cookies and
              use identifiers to choose and measure ads. Google&apos;s{" "}
              <a href="https://policies.google.com/technologies/ads">
                advertising policy
              </a>{" "}
              explains how.
            </p>
          </Section>
        ) : null}

        <Section id="servers" title="Servers and logs">
          <p>
            {SITE_NAME}&apos;s database holds air quality readings only: station and
            city values and their daily history. It holds nothing about visitors. Our
            hosting provider may keep standard request logs, such as IP address, page
            address and time, for security and operations.
          </p>
        </Section>

        {email ? (
          <Section id="contact" title="Contact">
            <p>
              Questions about this page? Write to <ContactLink email={email} />.
            </p>
          </Section>
        ) : null}
      </div>
    </div>
  );
}
