import type { SearchHit } from "@/lib/types";

const KEY = "hawa-recent-searches";
const MAX = 5;

export type RecentPlace = Pick<SearchHit, "kind" | "slug" | "label" | "detail">;

export function readRecent(): RecentPlace[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: RecentPlace[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      if (r.kind !== "city" && r.kind !== "station") continue;
      if (typeof r.slug !== "string" || typeof r.label !== "string") continue;
      out.push({
        kind: r.kind,
        slug: r.slug,
        label: r.label,
        detail: typeof r.detail === "string" ? r.detail : "",
      });
    }
    return out.slice(0, MAX);
  } catch {
    return [];
  }
}

export function pushRecent(hit: RecentPlace): RecentPlace[] {
  const next = [
    { kind: hit.kind, slug: hit.slug, label: hit.label, detail: hit.detail },
    ...readRecent().filter((p) => !(p.kind === hit.kind && p.slug === hit.slug)),
  ].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  return next;
}

export function clearRecent(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}
