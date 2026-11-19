import { connection } from "next/server";
import { CACHE, jsonCached, route } from "@/lib/api";
import { listMapCities } from "@/lib/report";

export const GET = route(
  "map",
  { limit: 30, windowMs: 60_000 },
  async (request) => {
    await connection();
    const cities = await listMapCities();
    return jsonCached(
      request,
      { cities },
      cities.length > 0 ? CACHE.list : CACHE.brief,
    );
  },
);
