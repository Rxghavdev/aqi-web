import { connection } from "next/server";
import { currentWeather } from "@/lib/sources/weather";

export async function GET(request: Request) {
  await connection();
  const params = new URL(request.url).searchParams;
  const lat = parseCoord(params.get("lat"), -90, 90);
  const lon = parseCoord(params.get("lon"), -180, 180);
  if (lat == null || lon == null) {
    return Response.json({ error: "Bad weather query" }, { status: 400 });
  }
  const weather = await currentWeather(lat, lon);
  return Response.json(
    { weather },
    { headers: { "Cache-Control": "public, max-age=600" } },
  );
}

function parseCoord(value: string | null, min: number, max: number): number | null {
  if (value == null || value.trim() === "" || value.length > 32) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}
