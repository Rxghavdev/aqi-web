import { searchPlaces } from "@/lib/report";

export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 80);
  const hits = query.trim() ? await searchPlaces(query) : [];
  return Response.json(hits, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
