import assert from "node:assert/strict";
import test from "node:test";
import { SingleFlight, withDeadline } from "./single-flight.ts";

test("concurrent callers share one run", async () => {
  const flight = new SingleFlight<string, number>();
  let calls = 0;
  const work = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return 42;
  };
  const results = await Promise.all([
    flight.run("k", work),
    flight.run("k", work),
    flight.run("k", work),
  ]);
  assert.deepEqual(results, [42, 42, 42]);
  assert.equal(calls, 1);
  assert.equal(flight.size, 0);
});

test("a failure is shared, then cleared so the next call retries", async () => {
  const flight = new SingleFlight<string, number>();
  let calls = 0;
  const failing = async () => {
    calls += 1;
    throw new Error("boom");
  };
  const [a, b] = await Promise.allSettled([
    flight.run("k", failing),
    flight.run("k", failing),
  ]);
  assert.equal(a.status, "rejected");
  assert.equal(b.status, "rejected");
  assert.equal(calls, 1);
  assert.equal(await flight.run("k", async () => 7), 7);
});

test("different keys run independently", async () => {
  const flight = new SingleFlight<string, string>();
  const out = await Promise.all([
    flight.run("a", async () => "a"),
    flight.run("b", async () => "b"),
  ]);
  assert.deepEqual(out, ["a", "b"]);
});

test("withDeadline falls back when the work is slow, and the work still finishes", async () => {
  let finished = false;
  const slow = new Promise<string>((resolve) =>
    setTimeout(() => {
      finished = true;
      resolve("late");
    }, 60),
  );
  assert.equal(await withDeadline(slow, 10, "fallback"), "fallback");
  assert.equal(finished, false);
  assert.equal(await slow, "late");
  assert.equal(finished, true);
});

test("withDeadline returns the value when it is in time, and falls back on rejection", async () => {
  assert.equal(await withDeadline(Promise.resolve("ok"), 50, "fallback"), "ok");
  assert.equal(await withDeadline(Promise.reject(new Error("x")), 50, "fallback"), "fallback");
});
