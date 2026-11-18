import { getPlace } from "@/lib/report";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = (params.get("query") ?? "").slice(0, 80);
  const lat = parseCoord(params.get("lat"), -90, 90);
  const lon = parseCoord(params.get("lon"), -180, 180);
  const place = await getPlace({ query, lat, lon });
  return Response.json(place);
}

function parseCoord(value: string | null, min: number, max: number): number | undefined {
  if (value == null || value.trim() === "" || value.length > 32) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return undefined;
  return parsed;
}
