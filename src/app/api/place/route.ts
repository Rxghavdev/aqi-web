import { getPlace } from "@/lib/report";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = params.get("query") ?? undefined;
  const lat = parseCoord(params.get("lat"));
  const lon = parseCoord(params.get("lon"));
  const place = await getPlace({ query, lat, lon });
  return Response.json(place);
}

function parseCoord(value: string | null): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
