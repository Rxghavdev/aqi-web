import { slugify } from "@/lib/aggregate";
import type { CityAqi } from "@/lib/types";

export type CityRow = {
  slug: string;
  name: string;
  aqi: number | null;
  reporting: number;
  total: number;
};

export type StateGroup = {
  /** Anchor id, safe for a URL fragment. */
  id: string;
  state: string;
  cities: CityRow[];
};

/** States A to Z, cities A to Z inside each state. */
export function groupByState(cities: readonly CityAqi[]): StateGroup[] {
  const byState = new Map<string, CityRow[]>();
  for (const city of cities) {
    const row: CityRow = {
      slug: city.slug,
      name: city.city,
      aqi: Number.isFinite(city.aqi) ? city.aqi : null,
      reporting: city.stationsReporting,
      total: city.stationsTotal,
    };
    const list = byState.get(city.state);
    if (list) list.push(row);
    else byState.set(city.state, [row]);
  }
  const used = new Set<string>();
  return [...byState.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([state, rows]) => {
      let id = `state-${slugify(state) || "other"}`;
      while (used.has(id)) id = `${id}-x`;
      used.add(id);
      return {
        id,
        state,
        cities: rows.sort((a, b) => a.name.localeCompare(b.name)),
      };
    });
}
