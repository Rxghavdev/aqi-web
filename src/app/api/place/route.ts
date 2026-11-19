import {
  apiError,
  CACHE,
  jsonCached,
  parseLat,
  parseLon,
  parseQuery,
  route,
} from "@/lib/api";
import { getPlace } from "@/lib/report";

export const GET = route(
  "place",
  { limit: 30, windowMs: 60_000 },
  async (request) => {
    const params = new URL(request.url).searchParams;
    const query = parseQuery(params.get("query"), "query");
    if (!query.ok) return query.response;

    const hasLat = params.get("lat") != null && params.get("lat") !== "";
    const hasLon = params.get("lon") != null && params.get("lon") !== "";
    if (hasLat !== hasLon) {
      return apiError(
        "missing_parameter",
        `Send both "lat" and "lon", or neither.`,
        400,
      );
    }
    if (!hasLat && !query.value) {
      return apiError(
        "missing_parameter",
        `Send "lat" and "lon", or a "query".`,
        400,
      );
    }

    let lat: number | undefined;
    let lon: number | undefined;
    if (hasLat) {
      const parsedLat = parseLat(params.get("lat"));
      if (!parsedLat.ok) return parsedLat.response;
      const parsedLon = parseLon(params.get("lon"));
      if (!parsedLon.ok) return parsedLon.response;
      lat = parsedLat.value;
      lon = parsedLon.value;
    }

    // A null report (no snapshot yet, or no match) is a valid 200 for clients.
    const place = await getPlace({ query: query.value, lat, lon });
    return jsonCached(request, place, place ? CACHE.place : CACHE.brief);
  },
);
