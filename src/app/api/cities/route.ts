import { connection } from "next/server";
import { CACHE, jsonCached, route } from "@/lib/api";
import { listCities } from "@/lib/report";

export const GET = route(
  "cities",
  { limit: 30, windowMs: 60_000 },
  async (request) => {
    await connection();
    const cities = await listCities();
    return jsonCached(request, cities, cities.length > 0 ? CACHE.list : CACHE.brief);
  },
);
