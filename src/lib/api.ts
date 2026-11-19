import { createHash } from "node:crypto";
import { errorText, logError, logWarn } from "./log.ts";
import {
  clientKey,
  createRateLimiter,
  type RateLimiter,
  type RateLimitOptions,
} from "./rate-limit.ts";
import { shared } from "./shared.ts";

/**
 * Shared plumbing for the JSON routes under /api: one error shape, one
 * rate-limit wrapper, one caching helper, one set of input parsers.
 */

export type ApiErrorCode =
  | "bad_request"
  | "missing_parameter"
  | "invalid_parameter"
  | "query_too_long"
  | "rate_limited"
  | "internal";

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return Response.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store", ...headers } },
  );
}

export type CachePolicy = {
  /** Browser freshness, seconds. */
  maxAge: number;
  /** Shared-cache freshness, seconds. */
  sMaxAge: number;
  /** Serve stale while revalidating, seconds. */
  staleWhileRevalidate: number;
};

export const CACHE = {
  /** City lists and the map: refreshed every ~30 minutes upstream. */
  list: { maxAge: 60, sMaxAge: 300, staleWhileRevalidate: 900 },
  search: { maxAge: 60, sMaxAge: 300, staleWhileRevalidate: 600 },
  /** A place report carries optional hourly enrichment, so keep it short. */
  place: { maxAge: 30, sMaxAge: 60, staleWhileRevalidate: 300 },
  weather: { maxAge: 300, sMaxAge: 600, staleWhileRevalidate: 1800 },
  trend: { maxAge: 60, sMaxAge: 300, staleWhileRevalidate: 900 },
  /** Used when the body is empty or degraded, so a recovery shows quickly. */
  brief: { maxAge: 10, sMaxAge: 10, staleWhileRevalidate: 30 },
} as const satisfies Record<string, CachePolicy>;

export function cacheControl(policy: CachePolicy): string {
  return `public, max-age=${policy.maxAge}, s-maxage=${policy.sMaxAge}, stale-while-revalidate=${policy.staleWhileRevalidate}`;
}

/** Weak validator over the serialised body. Cheap at these payload sizes. */
export function etagFor(body: string): string {
  return `W/"${createHash("sha1").update(body).digest("base64url").slice(0, 22)}"`;
}

export function matchesEtag(header: string | null, etag: string): boolean {
  if (!header) return false;
  if (header.trim() === "*") return true;
  const bare = (tag: string) => tag.trim().replace(/^W\//, "");
  const ours = bare(etag);
  return header.split(",").some((tag) => bare(tag) === ours);
}

/** JSON with Cache-Control and an ETag; answers 304 when the client is current. */
export function jsonCached(
  request: Request,
  data: unknown,
  policy: CachePolicy,
): Response {
  const body = JSON.stringify(data);
  const etag = etagFor(body);
  const headers = {
    "Cache-Control": cacheControl(policy),
    ETag: etag,
    Vary: "Accept-Encoding",
  };
  if (matchesEtag(request.headers.get("if-none-match"), etag)) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(body, {
    status: 200,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

const limiters = shared("api.limiters", () => new Map<string, RateLimiter>());

function limiterFor(name: string, options: RateLimitOptions): RateLimiter {
  let limiter = limiters.get(name);
  if (!limiter) {
    limiter = createRateLimiter(options);
    limiters.set(name, limiter);
  }
  return limiter;
}

export type RouteOptions = RateLimitOptions;

/**
 * Wrap a GET handler with a per-IP rate limit and a last-resort catch.
 * A thrown error becomes a logged 500 with the standard body; it never leaks
 * a stack or message to the client.
 */
export function route(
  name: string,
  options: RouteOptions,
  handler: (request: Request) => Promise<Response> | Response,
): (request: Request) => Promise<Response> {
  const limiter = limiterFor(name, options);
  return async (request) => {
    const result = limiter.check(clientKey(request.headers));
    if (!result.ok) {
      logWarn("api.rate_limited", { route: name, retryAfterSec: result.retryAfterSec });
      return apiError(
        "rate_limited",
        "Too many requests. Try again in a moment.",
        429,
        {
          "Retry-After": String(result.retryAfterSec),
          "RateLimit-Limit": String(result.limit),
          "RateLimit-Remaining": "0",
        },
      );
    }
    try {
      return await handler(request);
    } catch (error) {
      logError("api.unhandled", { route: name, error: errorText(error) });
      return apiError("internal", "Something went wrong on our side.", 500);
    }
  };
}

/* ---------- input parsing ---------- */

export type Parsed<T> = { ok: true; value: T } | { ok: false; response: Response };

const fail = <T>(
  code: ApiErrorCode,
  message: string,
): Parsed<T> => ({ ok: false, response: apiError(code, message, 400) });

/** A finite number inside [min, max], from a short decimal string. */
export function parseNumber(
  raw: string | null,
  name: string,
  min: number,
  max: number,
): Parsed<number> {
  if (raw == null || raw.trim() === "") {
    return fail("missing_parameter", `Missing "${name}".`);
  }
  if (raw.length > 32 || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(raw.trim())) {
    return fail("invalid_parameter", `"${name}" must be a number.`);
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    return fail("invalid_parameter", `"${name}" must be between ${min} and ${max}.`);
  }
  return { ok: true, value };
}

export function parseLat(raw: string | null): Parsed<number> {
  return parseNumber(raw, "lat", -90, 90);
}

export function parseLon(raw: string | null): Parsed<number> {
  return parseNumber(raw, "lon", -180, 180);
}

/** Free text a person typed: collapsed whitespace, no control characters. */
export function cleanText(raw: string | null, maxLength: number): string {
  const text = (raw ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return text.slice(0, maxLength);
}

/** Beyond this the request is not a person typing, so it is refused. */
export const HARD_QUERY_LIMIT = 256;
export const QUERY_LIMIT = 80;

export function parseQuery(
  raw: string | null,
  name: string,
): Parsed<string> {
  if (raw != null && raw.length > HARD_QUERY_LIMIT) {
    return fail("query_too_long", `"${name}" is too long.`);
  }
  return { ok: true, value: cleanText(raw, QUERY_LIMIT) };
}
