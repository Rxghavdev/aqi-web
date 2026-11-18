import type { MetadataRoute } from "next";
import { unstable_rethrow } from "next/navigation";
import { siteUrl } from "@/lib/site";

const STATIC_PATHS = ["/", "/methodology", "/about", "/privacy"] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${base}${path === "/" ? "" : path}`,
  }));

  try {
    const { listCities, listStations } = await import("@/lib/report");
    const cities = await listCities();
    const seen = new Set<string>();

    if (Array.isArray(cities)) {
      for (const city of cities) {
        const slug = city?.slug?.trim();
        if (!slug || seen.has(slug)) continue;
        seen.add(slug);
        entries.push({ url: `${base}/city/${encodeURIComponent(slug)}` });
      }
    }

    // Station pages carry most of the long-tail search traffic.
    const stations = await listStations();
    if (Array.isArray(stations)) {
      for (const station of stations) {
        const slug = station?.slug?.trim();
        if (!slug || seen.has(slug)) continue;
        seen.add(slug);
        entries.push({ url: `${base}/station/${encodeURIComponent(slug)}` });
      }
    }
  } catch (error) {
    unstable_rethrow(error);
  }

  return entries;
}
