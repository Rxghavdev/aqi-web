# Hawa

India's air, in one number. Hawa shows the official National Air Quality Index (NAQI) from Central Pollution Control Board (CPCB) stations, with weather, pollutants and a 30-day history. A city figure is the average of its stations. A separate hourly estimate is shown only when it is well above the official number, and it never replaces it.

Data: Central Pollution Control Board (CPCB) via data.gov.in.

## Run locally

```bash
npm install
cp .env.example .env.local     # then put your data.gov.in key in DATA_GOV_API_KEY
npm run sync                   # downloads the CPCB feed into .cache/
npm run dev
```

`npm run sync` writes `.cache/cpcb-snapshot.json` and records today's readings in `.data/aqi.db`. Both are local, gitignored files. Pages read the cache; they do not call data.gov.in per visit.

## Checks

```bash
npm run typecheck
npm run lint
npm test
```

## Environment variables

| Variable | Required | What it does |
| --- | --- | --- |
| `DATA_GOV_API_KEY` | Yes, for live data | data.gov.in key. Server only. Without it the site serves whatever snapshot is already on disk and logs `refresh.failed`. |
| `NEXT_PUBLIC_SITE_URL` | Yes, in production | Public origin (`https://…`, no trailing slash) for canonicals, sitemap and Open Graph. A production build fails if it is missing or points at localhost. |
| `ALLOW_LOCAL_SITE_URL` | No | Set to `1` to build and run a production build on your own machine with a localhost origin. |
| `CPCB_PAGE_LIMIT` | No | Rows per CPCB page. Defaults to 10, which is all the public sample key allows. A registered key accepts larger pages (for example 1000) and refreshes in seconds. |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | No | AdSense client id (`ca-pub-…`). Also adds the Google ad hosts to the Content-Security-Policy and serves `/ads.txt`. Read at build time. |
| `NEXT_PUBLIC_ADSENSE_SLOT_HOME`, `NEXT_PUBLIC_ADSENSE_SLOT_CITY` | No | Ad slot ids. A slot renders only when both the client id and its slot id are set. Read at build time. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | No | Contact address on the About and Privacy pages. |
| `CSP_REPORT_ONLY` | No | `1` ships the Content-Security-Policy as report-only. Read at build time. |

`NEXT_PUBLIC_*` values and `CSP_REPORT_ONLY` are baked in when `next build` runs; change them and rebuild.

## Architecture

```text
data.gov.in (CPCB feed, paged)
        │  fetchAllCpcbRecords        retries, 429 pause, 20 s timeout per page
        ▼
  refreshSnapshot()  ── one at a time, backoff 5/10/20/30 min after a failure
        │  aggregateRecords           station + city NAQI (src/lib/aggregate.ts)
        ├──────────────► .cache/cpcb-snapshot.json   (atomic write: tmp + rename)
        └──────────────► .data/aqi.db  (SQLite, WAL)  one row per place per day, upserted
                                   ▲
 Open-Meteo (server only) ──┐      │ read
   weather        15 min LRU│      │
   hourly model   30 min LRU├──► src/lib/report.ts ──► pages (server components)
   30-day model trend ──────┘      │                    /api/* (rate limited, cached)
        │ detached, deduped         │
        └── stored in aqi.db ───────┘
```

Rules the code holds to:

- **Pages never wait on a download.** `kickRefresh()` starts a background refresh when the snapshot is older than 30 minutes and returns immediately. The page serves what is on disk.
- **Stale-while-error.** A failed refresh keeps the previous snapshot, marks it stale and backs off, so a dead upstream is not hit once per page view. A feed that suddenly lists less than half the known stations is treated as partial and rejected.
- **Optional pieces degrade, never fail.** Weather, the hourly estimate, the modelled trend and the history database are all optional. Each has a timeout (3.5–12 s), a cached or empty fallback and a short negative cache. The hourly estimate is waited for at most 400 ms; if it is late the page ships without it and the next visit has it.
- **Every cache is bounded.** In-memory caches are LRU with a TTL (`src/lib/lru.ts`). Upstream calls with the same key share one in-flight request (`src/lib/single-flight.ts`).
- **API routes** (`src/app/api/*`) share one wrapper (`src/lib/api.ts`): per-IP sliding-window rate limit (429 with `Retry-After`), input validation, `{ "error": { "code", "message" } }` errors, `Cache-Control` with `s-maxage` and `stale-while-revalidate`, and ETag / 304 on read-only JSON.
- **Real 404s** for unknown city and station slugs come from `src/proxy.ts`, which checks a cached slug set before rendering.
- **Logs** are one JSON line each (`src/lib/log.ts`), for example `{"event":"refresh.ok","stations":576,…}`. The data.gov.in key is scrubbed from every line.

## Deploy

Hawa is a Node server. The snapshot (`.cache/`) and history (`.data/`) live on disk, so use a host with a persistent filesystem. A serverless host forgets both between requests. In a container, mount a volume at `/app/.cache` and `/app/.data`, or set the working directory to a persistent path.

```bash
npm ci
NEXT_PUBLIC_SITE_URL=https://your-domain npm run build
DATA_GOV_API_KEY=… npm start
```

Notes:

- **Hourly sync.** Schedule `npm run sync` about once an hour (cron, a systemd timer or a scheduled container job) with `DATA_GOV_API_KEY` in its environment. It force-refreshes the snapshot and records history. Without it, a visit after 30 minutes of staleness starts the same refresh in the background, so the job is the guarantee and the visit is the safety net.
- **Run one web process per snapshot directory.** Several processes can read it; the temp-file-and-rename write is safe across processes. Rate limits and caches are per process.
- **Proxy headers.** Rate limiting keys on the first hop of `X-Forwarded-For`, then `X-Real-IP`. Put the app behind a proxy that sets one of them and strips client-supplied copies.
- **TLS and HSTS.** The app sends `Strict-Transport-Security` (one year, no `preload`). Terminate TLS in front of it.
- **Content-Security-Policy** is set in `next.config.ts`. Scripts allow `'unsafe-inline'` because the static page shell and React's streamed payload need it (a nonce would force every page to render per request, and a hash cannot cover per-page payloads). Everything else is locked: connections only to this origin and `tiles.openfreemap.org`, workers from `self` and `blob:` for MapLibre, no framing, no objects. Ad hosts are added only when `NEXT_PUBLIC_ADSENSE_CLIENT` is set. Use `CSP_REPORT_ONLY=1` for the first deploy if you want to watch for violations before enforcing.
- **Health check.** `GET /api/health` returns snapshot age and counts, history status and the last refresh result, with no secrets. It answers 200 with `"status": "ok"` or `"degraded"`; add `?strict=1` to get a 503 when degraded.
- **Ads.** Ad slots stay empty until the client id and slot ids are set.

## Runbook

**Data looks old.** `curl -s https://your-domain/api/health`. If `snapshot.stale` is true:

1. Read `refresh.lastError`. `DATA_GOV_API_KEY is not set` means the environment is missing the key. `CPCB HTTP 429` means data.gov.in is rate limiting; it clears on its own and the refresh pauses and retries. `CPCB HTTP 401/403` means the key was revoked or mistyped.
2. `refresh.retryAfter` is the earliest time a visit retries. To force it now, run `npm run sync` on the server.
3. Pages keep serving the last good snapshot the whole time.

**Feed is empty or partial.** The refresh rejects a feed with no usable readings, or with fewer than half the known stations, and keeps the old snapshot (`refresh.failed` in the logs with the counts). Nothing to do unless it persists; then check the feed at data.gov.in.

**Snapshot file is damaged.** Entries that fail validation are dropped, and a file that is not valid JSON is ignored with a `snapshot.corrupt` log line while the last good copy keeps serving. Run `npm run sync` to rewrite it, or delete `.cache/cpcb-snapshot.json`.

**History is unavailable.** `history.status` in `/api/health` reads `unavailable`. Charts show an empty series with no error. A damaged `aqi.db` is moved to `aqi.db.corrupt-<time>` and recreated on the next open; official history refills from the next refresh. Deleting `.data/` is always safe.

**Map is blank in a new deployment.** Check the browser console for Content-Security-Policy violations. Redeploy once with `CSP_REPORT_ONLY=1` to see them without blocking.

**Rate limit complaints.** Limits are per IP, per minute: search 120, weather and trend 60, place, map, cities and health 30. They are set per route in `src/app/api/*/route.ts`.
