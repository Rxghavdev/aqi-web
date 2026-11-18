import { NextResponse } from "next/server";
import {
  kolkataDate,
  modelFetchedOn,
  openHistory,
  parseTrendQuery,
  rangeStart,
  readTrend,
  recordModelPoints,
} from "@/lib/history";
import { readSnapshot } from "@/lib/snapshot";
import { fetchModelTrend } from "@/lib/sources/model-trend";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = parseTrendQuery({
    kind: url.searchParams.get("kind"),
    slug: url.searchParams.get("slug"),
    range: url.searchParams.get("range"),
  });
  if (!query) {
    return NextResponse.json({ error: "Bad trend query" }, { status: 400 });
  }

  const db = openHistory();
  const today = kolkataDate();

  // Official points are already in SQLite. The model line is a nicety, so it is
  // fetched only after the official series is ready to send, and never awaited.
  const series = readTrend(db, query, today);
  if (modelFetchedOn(db, query.kind, query.slug) !== today) {
    void backfillModel(db, query.kind, query.slug, today);
  }

  return NextResponse.json(
    { range: query.range, official: series.official, model: series.model },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}

/**
 * Fetch the CAMS trend in the background and store it for the next request.
 * Runs detached: a slow or failing model never delays the chart.
 */
async function backfillModel(
  db: ReturnType<typeof openHistory>,
  kind: "city" | "station",
  slug: string,
  today: string,
): Promise<void> {
  try {
    const spot = await findSpot(kind, slug);
    if (!spot) return;
    const points = await fetchModelTrend(
      spot.latitude,
      spot.longitude,
      rangeStart("6m", today),
      today,
    );
    if (points.length > 0) recordModelPoints(db, kind, slug, points, today);
  } catch {
    /* A missing model line must not affect the official series. */
  }
}

async function findSpot(
  kind: "city" | "station",
  slug: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const { snapshot } = await readSnapshot();
  if (!snapshot) return null;
  if (kind === "station") {
    const station = snapshot.stations.find((item) => item.slug === slug);
    return station ? { latitude: station.latitude, longitude: station.longitude } : null;
  }
  const city = snapshot.cities.find((entry) => entry.slug === slug);
  if (!city) return null;
  const stations = snapshot.stations.filter(
    (item) => item.city === city.city && item.state === city.state,
  );
  if (stations.length === 0) return null;
  const latitude = stations.reduce((sum, item) => sum + item.latitude, 0) / stations.length;
  const longitude = stations.reduce((sum, item) => sum + item.longitude, 0) / stations.length;
  return { latitude, longitude };
}
