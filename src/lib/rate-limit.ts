import { LruCache } from "./lru.ts";

/**
 * In-process sliding-window rate limiter.
 *
 * Uses the two-bucket approximation: the count in the current window plus the
 * previous window's count weighted by how much of it still overlaps. That is
 * O(1) memory per key and smooths the burst a fixed window allows at its edge.
 * Keys live in a bounded LRU, so a flood of distinct addresses cannot grow
 * memory; the oldest idle address is forgotten first.
 *
 * State is per server process. Behind several instances each enforces its own
 * budget, which is fine for this app's abuse protection; use an edge or
 * gateway limit when a hard global cap matters.
 */

export type RateLimitOptions = {
  /** Requests allowed per window, per key. */
  limit: number;
  windowMs: number;
  /** Most distinct keys tracked at once. */
  maxKeys?: number;
  now?: () => number;
};

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Whole seconds until a request would be allowed again. 0 when ok. */
  retryAfterSec: number;
};

type Window = { start: number; count: number; previous: number };

export type RateLimiter = {
  check(key: string): RateLimitResult;
  readonly size: number;
};

export function createRateLimiter(options: RateLimitOptions): RateLimiter {
  const { limit, windowMs } = options;
  if (!(limit >= 1) || !(windowMs >= 1)) {
    throw new RangeError("limit and windowMs must be positive");
  }
  const now = options.now ?? Date.now;
  const windows = new LruCache<string, Window>({
    max: options.maxKeys ?? 5_000,
    ttlMs: windowMs * 2,
    now,
  });

  return {
    get size() {
      return windows.size;
    },
    check(key: string): RateLimitResult {
      const at = now();
      const start = at - (at % windowMs);
      let state = windows.get(key);
      if (!state) {
        state = { start, count: 0, previous: 0 };
      } else if (state.start !== start) {
        const gap = (start - state.start) / windowMs;
        state = { start, count: 0, previous: gap === 1 ? state.count : 0 };
      }

      const elapsed = (at - start) / windowMs;
      const used = state.count + state.previous * (1 - elapsed);
      if (used >= limit) {
        windows.set(key, state);
        return {
          ok: false,
          limit,
          remaining: 0,
          retryAfterSec: retryAfter(state, limit, windowMs, at, start),
        };
      }
      state.count += 1;
      windows.set(key, state);
      return {
        ok: true,
        limit,
        remaining: Math.max(0, Math.floor(limit - (used + 1))),
        retryAfterSec: 0,
      };
    },
  };
}

/** Seconds until the weighted count drops below the limit. Never below 1. */
function retryAfter(
  state: Window,
  limit: number,
  windowMs: number,
  at: number,
  start: number,
): number {
  const windowEnd = start + windowMs;
  if (state.previous > 0) {
    // used(t) = count + previous * (1 - (t - start) / windowMs) falls linearly.
    const clearAt = start + ((state.count + state.previous - limit) / state.previous) * windowMs;
    if (clearAt > at && clearAt < windowEnd) {
      return Math.max(1, Math.ceil((clearAt - at) / 1000));
    }
  }
  // Otherwise the next window opens with this one as its (decaying) history.
  return Math.max(1, Math.ceil((windowEnd - at) / 1000));
}

const IP_SHAPE = /^[0-9a-fA-F:.]{2,45}$/;

/**
 * The visitor's address: first hop of `x-forwarded-for`, else `x-real-ip`,
 * else a shared "unknown" bucket. Anything that does not look like an IP is
 * ignored, so a forged header cannot mint unlimited keys out of free text.
 *
 * These headers are only trustworthy behind a proxy that sets them. Without
 * one a client can pick its own, which only lets it rotate buckets; the
 * bounded key store still protects memory.
 */
export function clientKey(headers: Pick<Headers, "get">): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim() ?? "";
    if (IP_SHAPE.test(first)) return first.toLowerCase();
  }
  const real = headers.get("x-real-ip")?.trim() ?? "";
  if (IP_SHAPE.test(real)) return real.toLowerCase();
  return "unknown";
}
