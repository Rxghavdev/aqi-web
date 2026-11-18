# AQI Desk

India's official air quality, station by station. The number on the site is the Central Pollution Control Board National Air Quality Index, from the public data.gov.in feed.

A city figure is the average of its stations. A separate "rising this hour" line appears only when an hourly model is well above that official number. It does not replace it.

## Run

```bash
npm install
cp .env.example .env.local
```

Put your data.gov.in API key in `DATA_GOV_API_KEY`, then:

```bash
npm run sync
npm run dev
```

`npm run sync` writes `.cache/cpcb-snapshot.json`. That file is local and is not committed. The pages read the cache. They do not call the government API on every visit.

## Checks

```bash
npm test
```

## Deploy

This app is a Node server. The CPCB snapshot and the trend database live on disk (`.cache` and `.data`), so host it where the filesystem persists. A serverless host will forget both after each request.

```bash
npm run sync
npm run build
npm start
```

Set `DATA_GOV_API_KEY` and `NEXT_PUBLIC_SITE_URL` in the host environment. Run `npm run sync` on a schedule, about once an hour. The pages read the cache. They do not call the government API for every visitor.

`NEXT_PUBLIC_SITE_URL` must be your public https address. A production build refuses to start without it, or with a localhost address. To test a production build on your own machine, set `ALLOW_LOCAL_SITE_URL=1`. If the cache is more than 30 minutes old, a visit starts a background refresh, so the hourly job is a safety net and not the only source.

The moving sky on the reading card is plain CSS. It follows the official band and stops when the visitor's system asks for reduced motion.

Ad slots stay empty until `NEXT_PUBLIC_ADSENSE_CLIENT` and the slot ids are set.
