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
