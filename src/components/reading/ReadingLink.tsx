import Link from "next/link";
import { bandAccent, bandNumberColor } from "@/lib/aqi";
import type { Band } from "@/lib/types";
import { bandLabel, finiteAqi } from "./text";

export function ReadingLink({
  href,
  title,
  meta,
  aqi,
  band,
}: {
  href: string;
  title: string;
  meta?: string;
  aqi: number | null;
  band: Band | null;
}) {
  const value = finiteAqi(aqi);
  return (
    <Link href={href} className="row-link">
      <span>
        {title}
        {meta ? <span className="row-meta"> · {meta}</span> : null}
      </span>
      <span className="row-aqi">
        <span className="band-word" style={{ color: bandAccent(band) }}>
          {bandLabel(band)}
        </span>
        <span className="row-value" style={{ color: bandNumberColor(band) }}>
          <span className="sr-only">AQI </span>
          {value ?? "—"}
        </span>
      </span>
    </Link>
  );
}
