"use client";

import Link from "next/link";
import { useState } from "react";
import { bandAccent, bandNumberColor, bandTextColor } from "@/lib/aqi";
import type { StationAqi } from "@/lib/types";
import { officialStation, stationPath } from "./text";

const FIRST = 10;

/**
 * Ranked station rows: rank, name over a slim band-coloured bar, AQI chip.
 * The whole row is the link. Long cities show the worst ten and expand.
 */
export function StationRows({
  stations,
  activeSlug = null,
}: {
  stations: StationAqi[];
  activeSlug?: string | null;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? stations : stations.slice(0, FIRST);
  let rank = 0;
  const ranks = stations.map((station) =>
    officialStation(station).aqi == null ? null : ++rank,
  );

  return (
    <div className="srows">
      <ul className="srows-list">
        {shown.map((station, index) => {
          const { aqi, band } = officialStation(station);
          const percent =
            aqi == null ? 0 : Math.max(2, Math.min(100, (aqi / 500) * 100));
          const current = station.slug === activeSlug;
          return (
            <li key={station.slug}>
              <Link
                href={stationPath(station.slug)}
                className={current ? "srow is-current" : "srow"}
                aria-current={current ? "page" : undefined}
              >
                <span className="srow-rank" aria-hidden="true">
                  {ranks[index] ?? "–"}
                </span>
                <span className="srow-main">
                  <span className="srow-name">{station.name}</span>
                  <span className="srow-bar" aria-hidden="true">
                    <span
                      className="srow-fill"
                      style={{
                        width: `${percent}%`,
                        background: bandAccent(band),
                      }}
                    />
                  </span>
                </span>
                <span className="srow-end">
                  <span
                    className="srow-num"
                    style={{ color: bandNumberColor(band) }}
                  >
                    <span className="sr-only">AQI </span>
                    {aqi ?? "—"}
                  </span>
                  <span
                    className="srow-band"
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
      {stations.length > FIRST ? (
        <button
          type="button"
          className="srows-more"
          aria-expanded={all}
          onClick={() => setAll(!all)}
        >
          {all ? "Show fewer" : `Show all ${stations.length} stations`}
        </button>
      ) : null}
    </div>
  );
}
