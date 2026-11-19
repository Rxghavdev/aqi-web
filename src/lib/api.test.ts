import assert from "node:assert/strict";
import test from "node:test";
import {
  apiError,
  CACHE,
  cleanText,
  etagFor,
  jsonCached,
  matchesEtag,
  parseLat,
  parseLon,
  parseQuery,
  route,
} from "./api.ts";

test("apiError uses one shape and is never cached", async () => {
  const response = apiError("invalid_parameter", "Bad.", 400);
  assert.equal(response.status, 400);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    error: { code: "invalid_parameter", message: "Bad." },
  });
});

test("coordinates are range checked and must be plain numbers", () => {
  assert.deepEqual(parseLat("28.6"), { ok: true, value: 28.6 });
  assert.deepEqual(parseLon("-77.2"), { ok: true, value: -77.2 });
  for (const bad of ["91", "-91", "abc", "1e3", "0x10", "NaN", "Infinity", "1,5", "", " "]) {
    assert.equal(parseLat(bad).ok, false, `lat ${JSON.stringify(bad)}`);
  }
  assert.equal(parseLon("181").ok, false);
  assert.equal(parseLat(null).ok, false);
  assert.equal(parseLat("1".repeat(40)).ok, false);
});

test("coordinate failures answer 400 with a code", async () => {
  const missing = parseLat(null);
  assert.ok(!missing.ok);
  assert.equal(missing.response.status, 400);
  assert.equal(((await missing.response.json()) as { error: { code: string } }).error.code, "missing_parameter");
});

test("text is cleaned and capped; absurd input is refused", () => {
  assert.equal(cleanText("  New \n\t Delhi\u0000 ", 80), "New Delhi");
  assert.equal(cleanText("x".repeat(500), 80).length, 80);
  const ok = parseQuery("  Mumbai ", "q");
  assert.deepEqual(ok, { ok: true, value: "Mumbai" });
  const long = parseQuery("x".repeat(300), "q");
  assert.ok(!long.ok);
  assert.equal(long.response.status, 400);
  assert.deepEqual(parseQuery(null, "q"), { ok: true, value: "" });
});

test("etag matching handles lists, weak tags and wildcard", () => {
  const tag = etagFor('{"a":1}');
  assert.match(tag, /^W\/".{22}"$/);
  assert.equal(etagFor('{"a":1}'), tag);
  assert.notEqual(etagFor('{"a":2}'), tag);
  assert.equal(matchesEtag(tag, tag), true);
  assert.equal(matchesEtag(`"other", ${tag}`, tag), true);
  assert.equal(matchesEtag("*", tag), true);
  assert.equal(matchesEtag(null, tag), false);
  assert.equal(matchesEtag('W/"nope"', tag), false);
});

test("jsonCached sets cache headers and answers 304 to a current client", async () => {
  const first = jsonCached(new Request("http://x/a"), { n: 1 }, CACHE.list);
  assert.equal(first.status, 200);
  assert.match(first.headers.get("cache-control") ?? "", /^public, max-age=\d+, s-maxage=\d+, stale-while-revalidate=\d+$/);
  const etag = first.headers.get("etag");
  assert.ok(etag);
  assert.deepEqual(await first.json(), { n: 1 });

  const second = jsonCached(
    new Request("http://x/a", { headers: { "if-none-match": etag } }),
    { n: 1 },
    CACHE.list,
  );
  assert.equal(second.status, 304);
  assert.equal(await second.text(), "");
});

test("route answers 429 with Retry-After once the budget is spent", async () => {
  const handler = route("test-429", { limit: 2, windowMs: 60_000 }, () => Response.json({ ok: true }));
  const request = () =>
    new Request("http://x/", { headers: { "x-forwarded-for": "203.0.113.50" } });
  assert.equal((await handler(request())).status, 200);
  assert.equal((await handler(request())).status, 200);
  const blocked = await handler(request());
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("retry-after")) >= 1);
  assert.equal(blocked.headers.get("cache-control"), "no-store");
  assert.equal(((await blocked.json()) as { error: { code: string } }).error.code, "rate_limited");
  // A different visitor is unaffected.
  const other = await handler(new Request("http://x/", { headers: { "x-forwarded-for": "203.0.113.51" } }));
  assert.equal(other.status, 200);
});

test("route turns a thrown error into a clean 500", async () => {
  const handler = route("test-500", { limit: 10, windowMs: 60_000 }, () => {
    throw new Error("secret detail /etc/passwd");
  });
  const originalError = console.error;
  console.error = () => undefined;
  try {
    const response = await handler(new Request("http://x/"));
    assert.equal(response.status, 500);
    const body = (await response.json()) as { error: { code: string; message: string } };
    assert.equal(body.error.code, "internal");
    assert.ok(!body.error.message.includes("secret"));
  } finally {
    console.error = originalError;
  }
});
