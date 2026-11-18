import Link from "next/link";
import { bandAccent, bandNumberColor, bandTextColor } from "@/lib/aqi";
import type { StationAqi } from "@/lib/types";
import { officialStation, stationPath } from "./text";

/** Compact cards for stations around a place. The whole card is a link. */
export function NearbyCards({ stations }: { stations: StationAqi[] }) {
  if (stations.length === 0) return null;
  return (
    <ul className="ncards">
      {stations.map((station) => {
        const { aqi, band } = officialStation(station);
        return (
          <li key={station.slug}>
            <Link href={stationPath(station.slug)} className="ncard">
              <span
                className="ncard-bar"
                style={{ background: bandAccent(band) }}
                aria-hidden="true"
              />
              <span className="ncard-name" title={station.name}>
                {station.name}
              </span>
              <span className="ncard-place">{station.city}</span>
              <span className="ncard-read">
                <span
                  className="ncard-num"
                  style={{ color: bandNumberColor(band) }}
                >
                  <span className="sr-only">AQI </span>
                  {aqi ?? "—"}
                </span>
                <span
                  className="ncard-band"
                  style={{ color: bandTextColor(band) }}
                >
                  {band ?? "No AQI"}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
