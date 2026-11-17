import type { CpcbRecord } from "../aggregate.ts";

const RESOURCE =
  "https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69";

const CONCURRENCY = 5;
const ATTEMPTS = 3;
const PAGE_TIMEOUT_MS = 20_000;
const MAX_RATE_LIMIT_WAITS = 8;
const SLOW_GAP_MS = 2_000;

export type CpcbFetchInfo = {
  pageSize: number;
  requestedLimit: number;
  total: number;
  pages: number;
};

type Page = {
  total: number;
  limit: number;
  records: CpcbRecord[];
};

let lastInfo: CpcbFetchInfo | null = null;
let rateLimitPause: Promise<void> | null = null;
let pauseMs = 90_000;
let gapRaisedForThisPause = false;

const gate = {
  limit: CONCURRENCY,
  active: 0,
  gapMs: 0,
  nextAt: 0,
  successes: 0,
  ramps: 0,
  waiters: [] as Array<() => void>,
};

class CpcbStatusError extends Error {
  readonly status: number;

  constructor(status: number, offset: number) {
    super(`CPCB HTTP ${status} at offset ${offset}`);
    this.name = "CpcbStatusError";
    this.status = status;
  }
}

export function getLastCpcbFetchInfo(): CpcbFetchInfo | null {
  return lastInfo;
}

export async function fetchAllCpcbRecords(): Promise<CpcbRecord[]> {
  resetGate();
  const key = process.env.DATA_GOV_API_KEY?.trim() ?? "";
  if (!key) throw new Error("DATA_GOV_API_KEY is not set");

  const requestedLimit = pageLimit();
  const first = await fetchPage(0, requestedLimit, key);
  const total = first.total;
  if (!Number.isFinite(total) || total < 0) {
    throw new Error("CPCB response did not include a total");
  }

  let pageSize = requestedLimit;
  if (first.limit > 0 && first.limit < pageSize) pageSize = first.limit;
  if (first.records.length > 0 && first.records.length < pageSize) {
    pageSize = first.records.length;
  }
  if (pageSize < 1) pageSize = 1;

  if (first.records.length === 0 || total === 0) {
    lastInfo = { pageSize, requestedLimit, total, pages: 1 };
    console.error(
      `CPCB page size ${pageSize} (requested ${requestedLimit}), rows ${total}`,
    );
    return [];
  }

  const offsets: number[] = [];
  for (let offset = pageSize; offset < total; offset += pageSize) {
    offsets.push(offset);
  }

  const pages = new Map<number, CpcbRecord[]>();
  pages.set(0, first.records);
  let stopAt = Number.POSITIVE_INFINITY;
  let cursor = 0;
  let finished = 1;
  const pageCount = offsets.length + 1;

  console.error(
    `CPCB page size ${pageSize} (requested ${requestedLimit}), rows ${total}, pages ${pageCount}`,
  );

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, offsets.length) },
    async () => {
      while (cursor < offsets.length) {
        const index = cursor;
        cursor += 1;
        const offset = offsets[index];
        if (offset == null || offset >= stopAt) continue;
        const page = await fetchPage(offset, pageSize, key);
        if (page.records.length === 0) {
          stopAt = Math.min(stopAt, offset);
          continue;
        }
        pages.set(offset, page.records);
        finished += 1;
        if (finished % 20 === 0 || finished === pageCount) {
          console.error(
            `CPCB fetched ${Math.min(finished, pageCount)}/${pageCount} pages`,
          );
        }
      }
    },
  );
  await Promise.all(workers);

  const records = [...first.records];
  let usedPages = 1;
  for (const offset of offsets) {
    if (offset >= stopAt) break;
    const rows = pages.get(offset);
    if (!rows) throw new Error(`CPCB missing page at offset ${offset}`);
    records.push(...rows);
    usedPages += 1;
  }

  lastInfo = { pageSize, requestedLimit, total, pages: usedPages };
  return records;
}

function pageLimit(): number {
  const raw = process.env.CPCB_PAGE_LIMIT;
  const parsed = raw == null || raw.trim() === "" ? 10 : Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) return 10;
  return Math.floor(parsed);
}

async function fetchPage(
  offset: number,
  limit: number,
  key: string,
): Promise<Page> {
  let failures = 0;
  let rateWaits = 0;
  for (;;) {
    if (rateLimitPause) await rateLimitPause;
    try {
      const page = await withSlot(() => requestPage(offset, limit, key));
      noteSuccess();
      return page;
    } catch (error) {
      if (error instanceof CpcbStatusError && error.status === 429) {
        rateWaits += 1;
        if (rateWaits > MAX_RATE_LIMIT_WAITS) throw redact(error, key);
        noteRateLimit();
        await pauseForRateLimit();
        continue;
      }
      failures += 1;
      const safe = redact(error, key);
      if (failures >= ATTEMPTS) throw safe;
      await sleep(400 * failures);
    }
  }
}

function noteRateLimit(): void {
  gate.successes = 0;
  gate.limit = 1;
  if (gapRaisedForThisPause) return;
  gapRaisedForThisPause = true;
  gate.gapMs = gate.gapMs === 0 ? SLOW_GAP_MS : Math.min(gate.gapMs * 2, 15_000);
}

function noteSuccess(): void {
  gate.successes += 1;
  if (gate.limit < CONCURRENCY && gate.successes >= 30 && gate.ramps < 1) {
    gate.ramps += 1;
    gate.limit = CONCURRENCY;
    gate.gapMs = 0;
    gate.successes = 0;
    console.error("CPCB resuming concurrency 5");
    pump();
  }
}

function pauseForRateLimit(): Promise<void> {
  if (!rateLimitPause) {
    const ms = pauseMs;
    pauseMs = Math.min(pauseMs + 30_000, 180_000);
    console.error(
      `CPCB rate limited; pausing ${Math.round(ms / 1000)}s, then one request every ${Math.round(gate.gapMs / 1000)}s`,
    );
    rateLimitPause = sleep(ms).finally(() => {
      rateLimitPause = null;
      gapRaisedForThisPause = false;
    });
  }
  return rateLimitPause;
}

function resetGate(): void {
  gate.limit = CONCURRENCY;
  gate.active = 0;
  gate.gapMs = 0;
  gate.nextAt = 0;
  gate.successes = 0;
  gate.ramps = 0;
  gate.waiters = [];
  pauseMs = 90_000;
  rateLimitPause = null;
  gapRaisedForThisPause = false;
}

async function withSlot<T>(run: () => Promise<T>): Promise<T> {
  await acquire();
  try {
    if (gate.gapMs > 0) {
      const wait = gate.nextAt - Date.now();
      gate.nextAt = Math.max(Date.now(), gate.nextAt) + gate.gapMs;
      if (wait > 0) await sleep(wait);
    }
    return await run();
  } finally {
    release();
  }
}

function acquire(): Promise<void> {
  if (gate.active < gate.limit) {
    gate.active += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    gate.waiters.push(() => {
      gate.active += 1;
      resolve();
    });
  });
}

function release(): void {
  gate.active = Math.max(0, gate.active - 1);
  pump();
}

function pump(): void {
  while (gate.waiters.length > 0 && gate.active < gate.limit) {
    const wake = gate.waiters.shift();
    wake?.();
  }
}

async function requestPage(
  offset: number,
  limit: number,
  key: string,
): Promise<Page> {
  const url = new URL(RESOURCE);
  url.searchParams.set("api-key", key);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));

  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new CpcbStatusError(response.status, offset);
  }

  const body: unknown = await response.json();
  if (!body || typeof body !== "object") {
    throw new Error(`CPCB response was not an object at offset ${offset}`);
  }
  const record = body as {
    status?: unknown;
    total?: unknown;
    limit?: unknown;
    records?: unknown;
  };
  if (record.status != null && record.status !== "ok") {
    throw new Error(`CPCB status ${String(record.status)} at offset ${offset}`);
  }
  if (!Array.isArray(record.records)) {
    throw new Error(`CPCB records missing at offset ${offset}`);
  }

  return {
    total: typeof record.total === "number" ? record.total : Number(record.total),
    limit: typeof record.limit === "number" ? record.limit : Number(record.limit),
    records: record.records as CpcbRecord[],
  };
}

function redact(error: unknown, key: string): Error {
  const message = error instanceof Error ? error.message : String(error);
  const safe = key ? message.split(key).join("[redacted]") : message;
  return new Error(safe);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
