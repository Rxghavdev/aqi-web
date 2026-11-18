import assert from "node:assert/strict";
import test from "node:test";
import { shared } from "./shared.ts";

test("the same key returns the same instance and initialises once", () => {
  let inits = 0;
  const make = () => {
    inits += 1;
    return { n: 1 };
  };
  const a = shared("test.shared.one", make);
  const b = shared("test.shared.one", make);
  assert.equal(a, b);
  assert.equal(inits, 1);
  assert.notEqual(shared("test.shared.two", () => ({ n: 2 })), a);
});
