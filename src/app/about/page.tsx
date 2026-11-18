import type { Metadata } from "next";
import Link from "next/link";
import { ContactLink, contactEmail } from "@/components/pages/contact";
import { PageHeader, Section, Tile } from "@/components/pages/blocks";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: `${SITE_NAME} shows live air quality for India, built on the CPCB National Air Quality Index. One number for every city and station.`,
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  const email = contactEmail();
  return (
    <div className="pg">
      <PageHeader
        eyebrow={`About ${SITE_NAME}`}
        title={SITE_TAGLINE}
        lede={`${SITE_NAME} shows live air quality for India, built on the CPCB National Air Quality Index.`}
      />

      <div className="pg-prose">
        <Section id="what" title="What Hawa is">
          <p>
            Hawa is the Hindi and Urdu word for air. The site reads every station in
            the CPCB network and gives each city and station one clear AQI, with the
            pollutant behind it, the weather around it and the last 30 days to 6
            months of history.
          </p>
          <p>
            Every number is on the same scale, 0 to 500, so a station in Patna and a
            station in Pune compare directly.
          </p>
        </Section>

        <Section id="use" title="What you can do">
          <div className="pg-tiles">
            <Tile href="/" title="Find your place">
              Search a city or station, or let Hawa find the station nearest you.
            </Tile>
            <Tile href="/cities" title="Compare cities">
              Every city on one list, grouped by state.
            </Tile>
            <Tile href="/methodology#station" title="See what sets the number">
              A station&apos;s AQI comes from its highest pollutant. See which one.
            </Tile>
            <Tile href="/methodology#estimate" title="Look back">
              A daily history for every city and station, up to 6 months.
            </Tile>
          </div>
        </Section>

        <Section id="who" title="Who it is for">
          <p>
            Anyone who plans a day around the air: commuters, runners, parents on the
            school run, people with asthma or allergies, and anyone curious how their
            city compares with the rest of India.
          </p>
        </Section>

        <Section id="principles" title="How Hawa works">
          <ol className="pg-points">
            <li>
              <strong>One scale.</strong> Every figure follows the CPCB National Air
              Quality Index, so cities and stations line up.
            </li>
            <li>
              <strong>Official and Estimate stay apart.</strong> Official is what a
              CPCB station published. Estimate is modelled, always labelled and drawn
              differently.
            </li>
            <li>
              <strong>Nothing to sign up for.</strong> No account, no profile. Your
              location stays in your browser.
            </li>
          </ol>
          <p>
            The details are on the <Link href="/methodology">methodology</Link> page,
            and what Hawa does with your data is on the{" "}
            <Link href="/privacy">privacy</Link> page.
          </p>
        </Section>

        {email ? (
          <Section id="contact" title="Contact">
            <p>
              Questions, corrections, or a station that looks wrong? Write to{" "}
              <ContactLink email={email} />.
            </p>
          </Section>
        ) : null}
      </div>
    </div>
  );
}
