import Link from "next/link";
import { bandNumberColor, bandTextColor } from "@/lib/aqi";
import type { Band } from "@/lib/types";
import { bandLabel, finiteAqi } from "./text";

export function ReadingLink({
  href,
  title,
  meta,
  aqi,
  band,
  rank,
}: {
  href: string;
  title: string;
  meta?: string;
  aqi: number | null;
  band: Band | null;
  rank?: number;
}) {
  const value = finiteAqi(aqi);
  return (
    <Link
      href={href}
      className={rank == null ? "rank-row rank-row-plain" : "rank-row"}
    >
      {rank != null ? <span className="rank-index">{rank}</span> : null}
      <span className="rank-name">
        {title}
        {meta ? <span className="row-meta"> · {meta}</span> : null}
      </span>
      <span className="rank-end">
        <span className="band-word" style={{ color: bandTextColor(band) }}>
          {bandLabel(band)}
        </span>
        <span className="rank-num" style={{ color: bandNumberColor(band) }}>
          <span className="sr-only">AQI </span>
          {value ?? "—"}
        </span>
      </span>
    </Link>
  );
}
