import assert from "node:assert/strict";
import test from "node:test";
import { createBackfiller } from "./model-backfill.ts";

const spot = { latitude: 28.6, longitude: 77.2 };
const point = { date: "2026-11-01", aqi: 120 };

test("a place is fetched once even when scheduled repeatedly", async () => {
  let fetches = 0;
  const saved: string[] = [];
  const backfill = createBackfiller({
    locate: async () => spot,
    fetchPoints: async () => {
      fetches += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return [point];
    },
    save: (kind, slug) => saved.push(`${kind}:${slug}`),
  });
  assert.equal(backfill.schedule("city", "delhi", "2026-11-18"), true);
  assert.equal(backfill.schedule("city", "delhi", "2026-11-18"), false);
  await backfill.idle();
  assert.equal(backfill.schedule("city", "delhi", "2026-11-18"), false); // cooling down
  assert.equal(fetches, 1);
  assert.deepEqual(saved, ["city:delhi"]);
});

test("concurrency is capped", async () => {
  let active = 0;
  let peak = 0;
  const backfill = createBackfiller({
    maxConcurrent: 2,
    locate: async () => spot,
    fetchPoints: async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 15));
      active -= 1;
      return [];
    },
    save: () => undefined,
  });
  const started = ["a", "b", "c", "d"].map((slug) => backfill.schedule("station", slug, "2026-11-18"));
  assert.deepEqual(started, [true, true, false, false]);
  await backfill.idle();
  assert.equal(peak, 2);
});

test("a failing upstream is contained and not retried straight away", async () => {
  const originalError = console.error;
  console.error = () => undefined;
  try {
    let fetches = 0;
    const backfill = createBackfiller({
      locate: async () => spot,
      fetchPoints: async () => {
        fetches += 1;
        throw new Error("upstream down");
      },
      save: () => assert.fail("nothing to save"),
    });
    assert.equal(backfill.schedule("city", "pune", "2026-11-18"), true);
    await backfill.idle();
    assert.equal(backfill.schedule("city", "pune", "2026-11-18"), false);
    assert.equal(fetches, 1);
  } finally {
    console.error = originalError;
  }
});

test("an unknown place is not fetched", async () => {
  let fetches = 0;
  const backfill = createBackfiller({
    locate: async () => null,
    fetchPoints: async () => {
      fetches += 1;
      return [point];
    },
    save: () => assert.fail("nothing to save"),
  });
  backfill.schedule("city", "nowhere", "2026-11-18");
  await backfill.idle();
  assert.equal(fetches, 0);
});

test("the cool-down ends", async () => {
  let now = 0;
  let fetches = 0;
  const backfill = createBackfiller({
    cooldownMs: 1_000,
    now: () => now,
    locate: async () => spot,
    fetchPoints: async () => {
      fetches += 1;
      return [];
    },
    save: () => undefined,
  });
  backfill.schedule("city", "delhi", "2026-11-18");
  await backfill.idle();
  now = 1_500;
  assert.equal(backfill.schedule("city", "delhi", "2026-11-18"), true);
  await backfill.idle();
  assert.equal(fetches, 2);
});
