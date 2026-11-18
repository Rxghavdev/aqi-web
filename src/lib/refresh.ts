import { readSnapshot, refreshSnapshot } from "./snapshot.ts";

const BUILDING = process.env.NEXT_PHASE === "phase-production-build";

/**
 * Start a background refresh when the cache is old.
 * Never awaited by a page: the page serves what is on disk and the
 * download lands for the next request. Skipped during a production build
 * so prerendering does not reach out to the network.
 */
export function kickRefresh(): void {
  if (BUILDING) return;
  void readSnapshot()
    .then(({ stale }) => {
      if (!stale) return;
      return refreshSnapshot().then(() => undefined);
    })
    .catch(() => {
      /* a failed background refresh leaves the previous file in place */
    });
}
