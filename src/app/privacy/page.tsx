import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What AQI Desk does with a search and a location request.",
};

export default function PrivacyPage() {
  return (
    <article className="copy">
      <h1 className="page-title">Privacy</h1>
      <div className="copy-body">
        <p>
          The search box sends what you type to this site, which matches it to a
          city or station.
        </p>
        <p>
          Use my location asks your browser for coordinates. The next address
          includes latitude and longitude, written to four decimal places. You can
          search by name instead.
        </p>
        <p>
          Those coordinates are used to find the nearest public station. AQI Desk
          does not sell them, and it does not ask you to create an account.
        </p>
        <p>
          If advertising is turned on, Google may set cookies on ad placements.{" "}
          <a href="https://policies.google.com/technologies/ads">
            Google&apos;s advertising policy
          </a>{" "}
          describes that. Until a publisher id is added, the ad slots stay empty.
        </p>
      </div>
    </article>
  );
}
