import Link from "next/link";
import type { CityAqi } from "@/lib/types";
import { cityPath } from "./text";

export function CityAverageLink({ city }: { city: CityAqi }) {
  const value = city.aqi != null && Number.isFinite(city.aqi) ? String(city.aqi) : "—";
  const band = city.band ? `, ${city.band}` : "";
  return (
    <p className="fact-row">
      <Link href={cityPath(city.slug)} className="fact-link">
        City average {value}
        {band}
      </Link>
    </p>
  );
}
