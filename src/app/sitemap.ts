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
    const { listCities } = await import("@/lib/report");
    const cities = await listCities();
    if (!Array.isArray(cities)) return entries;

    const seen = new Set<string>();
    for (const city of cities) {
      const slug = city?.slug?.trim();
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      entries.push({ url: `${base}/city/${encodeURIComponent(slug)}` });
    }
  } catch (error) {
    unstable_rethrow(error);
  }

  return entries;
}
