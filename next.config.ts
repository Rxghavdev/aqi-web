import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const adsEnabled = Boolean(process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim());
/** Only a real https deployment upgrades requests; a local `next start` stays on http. */
const httpsSite = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().startsWith("https://");

/**
 * Content Security Policy.
 *
 * Why not a nonce or hash: a nonce needs every page rendered per request,
 * which would give up the static shell this app is built around. A hash cannot
 * cover React's streamed inline payload scripts (`self.__next_f.push(...)`),
 * whose text changes with every page, so it would block hydration. The
 * documented option for a static shell is therefore `'unsafe-inline'` for
 * scripts, with everything else locked down: no third-party script hosts, no
 * object/embed, no framing, no foreign form targets, and connections only to
 * this origin and the map tile host.
 *
 * What each origin is for (verified from the code, not guessed):
 * - tiles.openfreemap.org: MapLibre style JSON, vector tiles, glyphs and
 *   sprites (see src/components/map/StationMap.tsx).
 * - blob: in worker-src / img-src: MapLibre builds its tile workers and
 *   decoded sprite images from blobs.
 * - Open-Meteo and data.gov.in are called from the server only, so they are
 *   deliberately absent from connect-src.
 * - Google AdSense hosts are added only when NEXT_PUBLIC_ADSENSE_CLIENT is set.
 * - 'unsafe-eval' is development only (React debugging, HMR).
 *
 * Set CSP_REPORT_ONLY=1 to ship the same policy as report-only while checking
 * a new deployment, with no blocking.
 */
function contentSecurityPolicy(): string {
  const ads = {
    script: [
      "https://pagead2.googlesyndication.com",
      "https://*.googlesyndication.com",
      "https://*.googleadservices.com",
      "https://www.googletagservices.com",
      "https://*.doubleclick.net",
      "https://*.google.com",
    ],
    connect: [
      "https://pagead2.googlesyndication.com",
      "https://*.googlesyndication.com",
      "https://*.doubleclick.net",
      "https://*.google.com",
    ],
    frame: [
      "https://googleads.g.doubleclick.net",
      "https://*.doubleclick.net",
      "https://tpc.googlesyndication.com",
      "https://*.googlesyndication.com",
      "https://*.google.com",
    ],
  };

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      ...(isDev ? ["'unsafe-eval'"] : []),
      ...(adsEnabled ? ads.script : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    // Ads serve creatives from many hosts, so images open up to https only then.
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      "https://tiles.openfreemap.org",
      ...(adsEnabled ? ["https:"] : []),
    ],
    "font-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      "https://tiles.openfreemap.org",
      ...(isDev ? ["ws:", "wss:"] : []),
      ...(adsEnabled ? ads.connect : []),
    ],
    "worker-src": ["'self'", "blob:"],
    "child-src": ["'self'", "blob:"],
    "frame-src": adsEnabled ? ads.frame : ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "manifest-src": ["'self'"],
  };

  const parts = Object.entries(directives).map(
    ([name, values]) => `${name} ${values.join(" ")}`,
  );
  if (!isDev && httpsSite) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

const cspHeader =
  process.env.CSP_REPORT_ONLY === "1"
    ? "Content-Security-Policy-Report-Only"
    : "Content-Security-Policy";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["node:sqlite"],
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: cspHeader, value: contentSecurityPolicy() },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value:
              "geolocation=(self), camera=(), microphone=(), payment=(), usb=()",
          },
          // Browsers ignore HSTS over plain http, so this is inert on localhost.
          // No `preload`: that is a commitment to make once the domain is final.
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
