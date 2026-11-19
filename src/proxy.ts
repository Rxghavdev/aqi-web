import { NextResponse, type NextRequest } from "next/server";

/**
 * Unknown city and station slugs answer 404 before rendering.
 *
 * With Cache Components the prerendered shell is sent first, which fixes the
 * status at 200, so a `notFound()` inside the page can only add a noindex tag.
 * This check runs before the response begins, which is the only place a real
 * 404 is still possible.
 *
 * Costs: one stat every few seconds at most, a re-read only when the file
 * changed, and one cached slug set. Only the slug lists are kept, not the
 * snapshot, and only for these two routes. The cache is a single replaceable
 * object, so it cannot grow; slugs that cannot be real are refused before any
 * lookup, so junk paths never reach the file system.
 */

type Cache = { mtimeMs: number; checkedAt: number; cities: Set<string>; stations: Set<string> };

/** Slugs are lowercase letters, digits and hyphens (see `slugify`). */
const SLUG_SHAPE = /^[a-z0-9-]{1,200}$/;
/** How long a stat result is trusted before the file is checked again. */
const CHECK_EVERY_MS = 5_000;

let cache: Cache | null = null;
let loading: Promise<Cache | null> | null = null;

async function slugSets(): Promise<Cache | null> {
  const now = Date.now();
  if (cache && now - cache.checkedAt < CHECK_EVERY_MS) return cache;
  // One reader at a time: a burst after a refresh shares a single parse.
  loading ??= loadSlugSets().finally(() => {
    loading = null;
  });
  return loading;
}

async function loadSlugSets(): Promise<Cache | null> {
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const file = path.join(process.cwd(), ".cache", "cpcb-snapshot.json");
    const info = await fs.stat(file);
    if (cache && cache.mtimeMs === info.mtimeMs) {
      cache.checkedAt = Date.now();
      return cache;
    }

    const text = await fs.readFile(file, "utf8");
    const data = JSON.parse(text) as {
      cities?: Array<{ slug?: unknown }>;
      stations?: Array<{ slug?: unknown }>;
    };
    const cities = new Set<string>();
    const stations = new Set<string>();
    for (const city of data.cities ?? []) {
      if (typeof city?.slug === "string") cities.add(city.slug);
    }
    for (const station of data.stations ?? []) {
      if (typeof station?.slug === "string") stations.add(station.slug);
    }
    // An empty or partial file must not turn every page into a 404.
    if (stations.size === 0) return cache;
    cache = { mtimeMs: info.mtimeMs, checkedAt: Date.now(), cities, stations };
    return cache;
  } catch {
    // No cache yet, or unreadable: keep the last good sets if there are any,
    // otherwise let the page decide. It still renders the not-found UI with a
    // noindex tag.
    return cache;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const match = /^\/(city|station)\/([^/]+)\/?$/.exec(pathname);
  if (!match) return NextResponse.next();

  const [, kind, raw] = match;
  let slug: string;
  try {
    slug = decodeURIComponent(raw);
  } catch {
    return notFoundResponse(request);
  }

  if (!SLUG_SHAPE.test(slug)) return notFoundResponse(request);

  const sets = await slugSets();
  if (!sets) return NextResponse.next();

  const known = kind === "city" ? sets.cities.has(slug) : sets.stations.has(slug);
  if (known) return NextResponse.next();
  return notFoundResponse(request);
}

/** Rewrite to the not-found page so the body matches the 404 status. */
function notFoundResponse(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/_not-found";
  return NextResponse.rewrite(url, { status: 404 });
}

export const config = {
  matcher: ["/city/:path*", "/station/:path*"],
};
