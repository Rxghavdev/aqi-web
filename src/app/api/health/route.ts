import { connection } from "next/server";
import { route } from "@/lib/api";
import { historyStatus } from "@/lib/history";
import { errorText } from "@/lib/log";
import { getRefreshStatus, readSnapshot } from "@/lib/snapshot";

const STARTED_AT = Date.now();

/**
 * Operational detail for uptime checks and the runbook. Contains counts,
 * timestamps and short error strings only: no keys, paths or stack traces.
 *
 * Always 200 when the process can answer, with `status` saying how healthy the
 * data is. Add `?strict=1` for a 503 when `status` is not "ok", for monitors
 * that only read the HTTP code.
 */
export const GET = route(
  "health",
  { limit: 30, windowMs: 60_000 },
  async (request) => {
    await connection();
    const strict = new URL(request.url).searchParams.get("strict") === "1";

    let snapshotInfo: Record<string, unknown>;
    let dataOk = false;
    try {
      const { snapshot, stale } = await readSnapshot();
      const at = snapshot ? Date.parse(snapshot.snapshotAt) : NaN;
      snapshotInfo = snapshot
        ? {
            present: true,
            snapshotAt: snapshot.snapshotAt,
            ageSeconds: Number.isFinite(at)
              ? Math.max(0, Math.round((Date.now() - at) / 1000))
              : null,
            stale,
            stations: snapshot.stations.length,
            cities: snapshot.cities.length,
            rows: snapshot.rowCount,
          }
        : { present: false, snapshotAt: null, ageSeconds: null, stale: true, stations: 0, cities: 0, rows: 0 };
      dataOk = snapshot != null && !stale;
    } catch (error) {
      snapshotInfo = { present: false, error: errorText(error) };
    }

    const history = historyStatus();
    const status = dataOk ? "ok" : "degraded";
    const body = {
      status,
      uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
      snapshot: snapshotInfo,
      history,
      refresh: getRefreshStatus(),
    };

    if (strict && status !== "ok") {
      return Response.json(body, {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      });
    }
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  },
);

