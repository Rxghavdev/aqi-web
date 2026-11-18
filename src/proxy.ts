import { NextResponse, type NextRequest } from "next/server";

/**
 * Unknown city and station slugs answer 404 before rendering.
 *
 * With Cache Components the prerendered shell is sent first, which fixes the
 * status at 200, so a `notFound()` inside the page can only add a noindex tag.
 * This check runs before the response begins, which is the only place a real
 * 404 is still possible.
 *
 * Costs: one stat per cold start, then a cached slug set. Only the slug list is
 * kept, not the snapshot, and only for these two routes.
 */

type Cache = { mtimeMs: number; cities: Set<string>; stations: Set<string> };

let cache: Cache | null = null;

async function slugSets(): Promise<Cache | null> {
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const file = path.join(process.cwd(), ".cache", "cpcb-snapshot.json");
    const info = await fs.stat(file);
    if (cache && cache.mtimeMs === info.mtimeMs) return cache;

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
    cache = { mtimeMs: info.mtimeMs, cities, stations };
    return cache;
  } catch {
    // No cache yet, or unreadable: let the page decide. It still renders the
    // not-found UI with a noindex tag.
    return null;
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
