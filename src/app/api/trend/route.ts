import { apiError, CACHE, jsonCached, route } from "@/lib/api";
import {
  kolkataDate,
  modelFetchedOn,
  openHistory,
  parseTrendQuery,
  readTrend,
  type TrendPoint,
} from "@/lib/history";
import { errorText, logWarn } from "@/lib/log";
import { modelBackfill } from "@/lib/model-backfill";

export const GET = route(
  "trend",
  { limit: 60, windowMs: 60_000 },
  (request) => {
    const params = new URL(request.url).searchParams;
    const query = parseTrendQuery({
      kind: params.get("kind"),
      slug: params.get("slug"),
      range: params.get("range"),
    });
    if (!query) {
      return apiError(
        "invalid_parameter",
        `Use kind=city|station, range=1m|6m and a slug of lowercase letters, digits and hyphens.`,
        400,
      );
    }

    // History is optional. If the database is locked or unreadable the chart
    // gets empty series and a short cache time, never an error page.
    let official: TrendPoint[] = [];
    let model: TrendPoint[] = [];
    let degraded = false;
    try {
      const db = openHistory();
      const today = kolkataDate();
      ({ official, model } = readTrend(db, query, today));
      // The model line is a nicety: it is fetched after this response is
      // ready, never awaited, and shows up on the next request.
      if (modelFetchedOn(db, query.kind, query.slug) !== today) {
        modelBackfill.schedule(query.kind, query.slug, today);
      }
    } catch (error) {
      degraded = true;
      logWarn("trend.history_unavailable", { error: errorText(error) });
    }

    return jsonCached(
      request,
      { range: query.range, official, model },
      degraded ? CACHE.brief : CACHE.trend,
    );
  },
);
