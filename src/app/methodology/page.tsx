import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How AQI Desk uses India's National Air Quality Index from CPCB stations.",
};

export default function MethodologyPage() {
  return (
    <article className="copy">
      <h1 className="page-title">Methodology</h1>
      <div className="copy-body">
        <p>
          The number on AQI Desk is India&apos;s National Air Quality Index, as
          published by the Central Pollution Control Board.
        </p>
        <p>
          CPCB turns each pollutant into a sub-index. The worst sub-index is the
          station&apos;s AQI. A station number is published only when at least
          three pollutants are present, including PM2.5 or PM10.
        </p>
        <p>
          Most pollutants use a 24-hour average. CO and ozone use 8 hours, so a
          spike this hour shows up slowly.
        </p>
        <p>
          A city figure is the average of the stations in that city that published
          an official AQI. One monitor can be worse than the city number.
        </p>
        <p>
          On a station page, the sub-index list is index points on that same scale.
          It is not a list of concentrations.
        </p>
        <p>
          When the air is rising this hour, a separate strip says so. That figure
          comes from an hourly weather model, converted with the same India
          breakpoints. It is not the official number, and it does not replace it.
        </p>
        <p>
          The bands are 0–50 Good, 51–100 Satisfactory, 101–200 Moderate, 201–300
          Poor, 301–400 Very Poor, and 401–500 Severe. This is not medical advice.
        </p>
        <p>
          Readings come from the Central Pollution Control Board via data.gov.in.
          This is not a government website.
        </p>
      </div>
    </article>
  );
}
