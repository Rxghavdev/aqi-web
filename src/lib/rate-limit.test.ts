import assert from "node:assert/strict";
import test from "node:test";
import { clientKey, createRateLimiter } from "./rate-limit.ts";

function headers(values: Record<string, string>): Pick<Headers, "get"> {
  return new Headers(values);
}

test("allows up to the limit, then blocks with a retry time", () => {
  const limiter = createRateLimiter({ limit: 3, windowMs: 1_000, now: () => 10_000 });
  assert.equal(limiter.check("a").ok, true);
  assert.equal(limiter.check("a").ok, true);
  const third = limiter.check("a");
  assert.equal(third.ok, true);
  assert.equal(third.remaining, 0);
  const fourth = limiter.check("a");
  assert.equal(fourth.ok, false);
  assert.ok(fourth.retryAfterSec >= 1);
});

test("keys are independent", () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 1_000, now: () => 5_000 });
  assert.equal(limiter.check("a").ok, true);
  assert.equal(limiter.check("a").ok, false);
  assert.equal(limiter.check("b").ok, true);
});

test("the window slides: allowed again once the old window has decayed", () => {
  let now = 0;
  const limiter = createRateLimiter({ limit: 4, windowMs: 1_000, now: () => now });
  for (let i = 0; i < 4; i += 1) assert.equal(limiter.check("a").ok, true);
  assert.equal(limiter.check("a").ok, false);
  now = 1_000; // next window: previous count of 4 still weighs fully
  assert.equal(limiter.check("a").ok, false);
  now = 1_600; // 40% of the old window remains: 4 * 0.4 = 1.6 used
  assert.equal(limiter.check("a").ok, true);
  now = 5_000; // long idle
  assert.equal(limiter.check("a").ok, true);
});

test("a burst straddling a window edge cannot double the limit", () => {
  let now = 900;
  const limiter = createRateLimiter({ limit: 10, windowMs: 1_000, now: () => now });
  let allowed = 0;
  for (let i = 0; i < 10; i += 1) if (limiter.check("a").ok) allowed += 1;
  now = 1_100; // just across the edge
  for (let i = 0; i < 10; i += 1) if (limiter.check("a").ok) allowed += 1;
  assert.ok(allowed < 14, `allowed ${allowed}`);
});

test("retryAfterSec is at least 1 and not absurd", () => {
  let now = 0;
  const limiter = createRateLimiter({ limit: 1, windowMs: 60_000, now: () => now });
  limiter.check("a");
  now = 30_000;
  const blocked = limiter.check("a");
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterSec >= 1 && blocked.retryAfterSec <= 60);
});

test("memory is bounded by maxKeys", () => {
  const limiter = createRateLimiter({ limit: 5, windowMs: 60_000, maxKeys: 50 });
  for (let i = 0; i < 5_000; i += 1) limiter.check(`ip-${i}`);
  assert.ok(limiter.size <= 50);
});

test("clientKey prefers the first x-forwarded-for hop", () => {
  assert.equal(
    clientKey(headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1", "x-real-ip": "10.0.0.2" })),
    "203.0.113.7",
  );
});

test("clientKey falls back to x-real-ip, then a safe default", () => {
  assert.equal(clientKey(headers({ "x-real-ip": "198.51.100.4" })), "198.51.100.4");
  assert.equal(clientKey(headers({})), "unknown");
});

test("clientKey ignores values that are not addresses", () => {
  assert.equal(clientKey(headers({ "x-forwarded-for": "<script>alert(1)</script>" })), "unknown");
  assert.equal(clientKey(headers({ "x-forwarded-for": "a".repeat(500) })), "unknown");
  assert.equal(clientKey(headers({ "x-forwarded-for": "2001:db8::1" })), "2001:db8::1");
});

test("rejects a nonsense configuration", () => {
  assert.throws(() => createRateLimiter({ limit: 0, windowMs: 1_000 }), RangeError);
});
