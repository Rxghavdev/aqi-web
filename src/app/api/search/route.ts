import { CACHE, jsonCached, parseQuery, route } from "@/lib/api";
import { searchPlaces } from "@/lib/report";

export const GET = route(
  "search",
  // Typeahead fires per keystroke, so this is the most generous budget.
  { limit: 120, windowMs: 60_000 },
  async (request) => {
    const params = new URL(request.url).searchParams;
    const query = parseQuery(params.get("q"), "q");
    if (!query.ok) return query.response;
    const hits = query.value ? await searchPlaces(query.value) : [];
    return jsonCached(request, hits, CACHE.search);
  },
);
