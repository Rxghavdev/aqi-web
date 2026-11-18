import assert from "node:assert/strict";
import test from "node:test";
import { errorText, formatLog, scrub } from "./log.ts";

test("a log line is one JSON object with time, level and event", () => {
  const line = formatLog("warn", "upstream.failed", { source: "x", status: 503 });
  assert.equal(line.includes("\n"), false);
  const parsed = JSON.parse(line) as Record<string, unknown>;
  assert.equal(parsed.level, "warn");
  assert.equal(parsed.event, "upstream.failed");
  assert.equal(parsed.status, 503);
  assert.ok(typeof parsed.t === "string" && !Number.isNaN(Date.parse(parsed.t)));
});

test("api keys never reach a log line", () => {
  const previous = process.env.DATA_GOV_API_KEY;
  process.env.DATA_GOV_API_KEY = "abcdef123456SECRET";
  try {
    assert.equal(scrub("failed for abcdef123456SECRET today"), "failed for [redacted] today");
    const line = formatLog("error", "refresh.failed", {
      error: new Error("GET https://api.data.gov.in/x?api-key=abcdef123456SECRET&format=json 500"),
    });
    assert.ok(!line.includes("abcdef123456SECRET"));
    assert.ok(line.includes("[redacted]"));
    assert.ok(!errorText(new Error("api-key=zzz999")).includes("zzz999"));
  } finally {
    if (previous === undefined) delete process.env.DATA_GOV_API_KEY;
    else process.env.DATA_GOV_API_KEY = previous;
  }
});

test("long values are truncated", () => {
  assert.ok(scrub("x".repeat(5_000)).length < 400);
});
