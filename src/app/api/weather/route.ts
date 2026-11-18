import { connection } from "next/server";
import { CACHE, jsonCached, parseLat, parseLon, route } from "@/lib/api";
import { currentWeather } from "@/lib/sources/weather";

export const GET = route(
  "weather",
  { limit: 60, windowMs: 60_000 },
  async (request) => {
    await connection();
    const params = new URL(request.url).searchParams;
    const lat = parseLat(params.get("lat"));
    if (!lat.ok) return lat.response;
    const lon = parseLon(params.get("lon"));
    if (!lon.ok) return lon.response;

    // Never throws; null when the weather service is down or slow.
    const weather = await currentWeather(lat.value, lon.value);
    return jsonCached(
      request,
      { weather },
      weather ? CACHE.weather : CACHE.brief,
    );
  },
);
