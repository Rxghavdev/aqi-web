import { readSnapshot, refreshAllowed, refreshSnapshot } from "./snapshot.ts";

const BUILDING = process.env.NEXT_PHASE === "phase-production-build";

/**
 * Start a background refresh when the cache is old.
 * Never awaited by a page: the page serves what is on disk and the
 * download lands for the next request. Skipped during a production build
 * so prerendering does not reach out to the network.
 *
 * Failure behaviour (stale-while-error): the previous snapshot keeps serving,
 * and visits do not retry until a backoff passes (5, 10, 20, then 30 minutes),
 * so a dead upstream is not hammered once per page view. Only one refresh runs
 * at a time, however many requests arrive.
 */
export function kickRefresh(): void {
  if (BUILDING) return;
  // No clock read before the first await: during a prerender Next treats a
  // synchronous `Date.now()` as an unstable value and logs an error.
  void readSnapshot()
    .then(({ stale }) => {
      if (!stale || !refreshAllowed()) return;
      return refreshSnapshot().then(() => undefined);
    })
    .catch(() => {
      // refreshSnapshot already logged the failure and set the backoff, and
      // readSnapshot never throws. Nothing here may reach a page render.
    });
}
