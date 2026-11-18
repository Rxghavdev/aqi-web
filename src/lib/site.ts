export const SITE_NAME = "Hawa";

export const SITE_TAGLINE = "India's air, in one number.";

export const SITE_DESCRIPTION =
  "Live air quality for every Indian city and monitoring station, on the National Air Quality Index, with weather, pollutants and 30-day history.";

const LOCAL = "http://localhost:3000";

/**
 * Absolute origin for canonicals, JSON-LD and the sitemap.
 * A production build without a real origin would publish localhost URLs to
 * crawlers, so that combination fails loudly instead — unless the build is
 * deliberately local, which sets ALLOW_LOCAL_SITE_URL=1.
 */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const production = process.env.NODE_ENV === "production";
  const allowLocal = process.env.ALLOW_LOCAL_SITE_URL === "1";

  if (!raw) {
    if (production && !allowLocal) {
      throw new Error(
        "NEXT_PUBLIC_SITE_URL must be set for a production build. Set it to the public origin, or set ALLOW_LOCAL_SITE_URL=1 for a local build.",
      );
    }
    return LOCAL;
  }

  const cleaned = raw.replace(/\/$/, "");
  if (production && !allowLocal && isLocal(cleaned)) {
    throw new Error(
      `NEXT_PUBLIC_SITE_URL is "${cleaned}", a local address. Set the public origin before building for production, or set ALLOW_LOCAL_SITE_URL=1 for a local build.`,
    );
  }
  return cleaned;
}

function isLocal(value: string): boolean {
  return /(^https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|\/|$)/i.test(value);
}

/** Default document title and the name shown when the site is installed. */
export const SITE_TITLE = "Hawa — Live air quality across India";
