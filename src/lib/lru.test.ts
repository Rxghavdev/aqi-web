import assert from "node:assert/strict";
import test from "node:test";
import { LruCache } from "./lru.ts";

test("evicts the least recently used entry past max", () => {
  const cache = new LruCache<string, number>({ max: 2 });
  cache.set("a", 1);
  cache.set("b", 2);
  assert.equal(cache.get("a"), 1); // a is now most recent
  cache.set("c", 3);
  assert.equal(cache.size, 2);
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.get("a"), 1);
  assert.equal(cache.get("c"), 3);
});

test("entries expire after their ttl", () => {
  let now = 1_000;
  const cache = new LruCache<string, number>({ max: 5, ttlMs: 100, now: () => now });
  cache.set("a", 1);
  now += 99;
  assert.equal(cache.get("a"), 1);
  now += 2;
  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.size, 0);
});

test("a per-entry ttl overrides the default", () => {
  let now = 0;
  const cache = new LruCache<string, number>({ max: 5, ttlMs: 1_000, now: () => now });
  cache.set("short", 1, 10);
  cache.set("long", 2);
  now = 50;
  assert.equal(cache.has("short"), false);
  assert.equal(cache.has("long"), true);
});

test("overwriting a key refreshes it without growing the cache", () => {
  const cache = new LruCache<string, number>({ max: 2 });
  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("a", 10);
  cache.set("c", 3);
  assert.equal(cache.get("a"), 10);
  assert.equal(cache.get("b"), undefined);
});

test("expired entries are dropped before live ones when full", () => {
  let now = 0;
  const cache = new LruCache<string, number>({ max: 2, now: () => now });
  cache.set("old", 1, 10);
  cache.set("live", 2, 1_000);
  now = 20;
  cache.set("new", 3, 1_000);
  assert.equal(cache.get("live"), 2);
  assert.equal(cache.get("new"), 3);
});

test("stays bounded under many distinct keys", () => {
  const cache = new LruCache<number, number>({ max: 100 });
  for (let i = 0; i < 10_000; i += 1) cache.set(i, i);
  assert.equal(cache.size, 100);
  assert.equal(cache.get(9_999), 9_999);
  assert.equal(cache.get(0), undefined);
});

test("peek does not change recency", () => {
  const cache = new LruCache<string, number>({ max: 2 });
  cache.set("a", 1);
  cache.set("b", 2);
  cache.peek("a");
  cache.set("c", 3);
  assert.equal(cache.get("a"), undefined);
});

test("rejects a nonsense max", () => {
  assert.throws(() => new LruCache({ max: 0 }), RangeError);
});
