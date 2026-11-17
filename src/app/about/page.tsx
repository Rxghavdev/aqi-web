import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "AQI Desk publishes India's National Air Quality Index from CPCB stations.",
};

export default function AboutPage() {
  return (
    <article className="copy">
      <h1 className="page-title">About</h1>
      <div className="copy-body">
        <p>
          AQI Desk shows the official air number for Indian cities and for
          individual CPCB stations.
        </p>
        <p>
          Other sites mix private sensors and the US scale. The number here is the
          National Air Quality Index.
        </p>
        <p>
          The site is independent. It is not affiliated with the Central Pollution
          Control Board or the SAMEER app.
        </p>
        <p>
          The official portal is{" "}
          <a href="https://airquality.cpcb.gov.in/AQI_India/">
            airquality.cpcb.gov.in
          </a>
          .
        </p>
      </div>
    </article>
  );
}
