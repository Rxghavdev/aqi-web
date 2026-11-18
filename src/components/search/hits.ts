import type { Band, SearchHit } from "@/lib/types";
import { cityPath, stationPath } from "@/components/reading/text";

const BANDS = new Set<Band>([
  "Good",
  "Satisfactory",
  "Moderate",
  "Poor",
  "Very Poor",
  "Severe",
]);

export function hitPath(hit: Pick<SearchHit, "kind" | "slug">): string {
  return hit.kind === "city" ? cityPath(hit.slug) : stationPath(hit.slug);
}

export function parseHits(data: unknown): SearchHit[] {
  return extractRows(data).flatMap((row) => {
    const hit = asHit(row);
    return hit ? [hit] : [];
  });
}

function extractRows(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  const record = data as { hits?: unknown; results?: unknown };
  if (Array.isArray(record.hits)) return record.hits;
  if (Array.isArray(record.results)) return record.results;
  return [];
}

function asHit(value: unknown): SearchHit | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.kind !== "city" && row.kind !== "station") return null;
  if (typeof row.slug !== "string" || row.slug.length === 0) return null;
  if (typeof row.label !== "string") return null;
  const detail = typeof row.detail === "string" ? row.detail : "";
  const aqi = typeof row.aqi === "number" && Number.isFinite(row.aqi) ? row.aqi : null;
  const band =
    typeof row.band === "string" && BANDS.has(row.band as Band) ? (row.band as Band) : null;
  return { kind: row.kind, slug: row.slug, label: row.label, detail, aqi, band };
}
