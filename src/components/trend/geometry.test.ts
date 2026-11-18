import assert from "node:assert/strict";
import test from "node:test";
import {
  areaPath,
  clampBox,
  formatLong,
  formatShort,
  linearScale,
  mergeDays,
  monotonePath,
  nearestIndex,
  splitRuns,
  summarize,
  timeDomain,
  xTicks,
  yDomain,
  yTicks,
} from "./geometry.ts";

test("formats days", () => {
  assert.equal(formatShort("2026-11-18"), "18 Nov");
  assert.equal(formatLong("2026-11-18"), "Wed 18 Nov");
  assert.equal(formatShort("nope"), "nope");
});

test("official readings win over estimates for the same day", () => {
  const days = mergeDays(
    [{ date: "2026-11-17", aqi: 107.4 }],
    [
      { date: "2026-11-16", aqi: 150 },
      { date: "2026-11-17", aqi: 190 },
    ],
  );
  assert.deepEqual(
    days.map((d) => [d.date, d.aqi, d.kind]),
    [
      ["2026-11-16", 150, "estimate"],
      ["2026-11-17", 107, "official"],
    ],
  );
});

test("merge drops invalid rows and sorts", () => {
  const days = mergeDays(
    [
      { date: "2026-11-18", aqi: 90 },
      { date: "bad", aqi: 10 },
      { date: "2026-11-02", aqi: Number.NaN },
    ],
    [{ date: "2026-11-10", aqi: 120 }],
  );
  assert.deepEqual(days.map((d) => d.date), ["2026-11-10", "2026-11-18"]);
});

test("splitRuns groups consecutive kinds", () => {
  const days = mergeDays(
    [
      { date: "2026-11-03", aqi: 1 },
      { date: "2026-11-04", aqi: 1 },
    ],
    [
      { date: "2026-11-01", aqi: 1 },
      { date: "2026-11-02", aqi: 1 },
      { date: "2026-11-05", aqi: 1 },
    ],
  );
  assert.deepEqual(splitRuns(days), [
    { kind: "estimate", start: 0, end: 1 },
    { kind: "official", start: 2, end: 3 },
    { kind: "estimate", start: 4, end: 4 },
  ]);
});

test("summarize prefers the newest official reading for latest", () => {
  const days = mergeDays(
    [{ date: "2026-11-17", aqi: 107 }],
    [
      { date: "2026-11-16", aqi: 300 },
      { date: "2026-11-18", aqi: 40 },
    ],
  );
  const s = summarize(days);
  assert.equal(s.latest?.date, "2026-11-17");
  assert.equal(s.highest?.aqi, 300);
  assert.equal(s.lowest?.aqi, 40);
  assert.equal(summarize([]).latest, null);
});

test("yDomain snaps to 50s, keeps at least 100 and stays within 0-500", () => {
  assert.deepEqual(yDomain([107, 180]), { lo: 50, hi: 200 });
  assert.deepEqual(yDomain([120, 125]), { lo: 100, hi: 200 });
  assert.deepEqual(yDomain([5, 495]), { lo: 0, hi: 500 });
  assert.deepEqual(yDomain([498, 500]), { lo: 400, hi: 500 });
  assert.deepEqual(yDomain([]), { lo: 0, hi: 200 });
});

test("yTicks uses 50s on tight domains and band edges on wide ones", () => {
  assert.deepEqual(yTicks(50, 200, 200), [50, 100, 150, 200]);
  assert.deepEqual(yTicks(0, 500, 400), [50, 100, 200, 300, 400]);
});

test("yTicks drops ticks that would collide", () => {
  const ticks = yTicks(0, 500, 150);
  for (let i = 1; i < ticks.length; i += 1) {
    assert.ok((ticks[i] - ticks[i - 1]) * (150 / 500) >= 22);
  }
});

test("linearScale maps and handles a zero span", () => {
  const y = linearScale(0, 100, 200, 0);
  assert.equal(y(0), 200);
  assert.equal(y(100), 0);
  assert.equal(y(50), 100);
  assert.equal(linearScale(5, 5, 0, 10)(5), 5);
});

test("timeDomain pads a short history", () => {
  const days = mergeDays(
    [
      { date: "2026-11-17", aqi: 100 },
      { date: "2026-11-18", aqi: 107 },
    ],
    [],
  );
  const { min, max } = timeDomain(days);
  assert.equal((max - min) / 86_400_000, 6);
});

test("xTicks are whole days, ordered and include both ends", () => {
  const min = Date.UTC(2026, 9, 19);
  const max = Date.UTC(2026, 10, 18);
  const ticks = xTicks(min, max, 5);
  assert.equal(ticks[0], min);
  assert.equal(ticks[ticks.length - 1], max);
  assert.equal(ticks.length, 5);
  assert.deepEqual(xTicks(max, max, 5), [max]);
});

test("nearestIndex snaps to the closest day", () => {
  const xs = [10, 20, 40, 100];
  assert.equal(nearestIndex(xs, -50), 0);
  assert.equal(nearestIndex(xs, 14), 0);
  assert.equal(nearestIndex(xs, 16), 1);
  assert.equal(nearestIndex(xs, 31), 2);
  assert.equal(nearestIndex(xs, 90), 3);
  assert.equal(nearestIndex(xs, 5000), 3);
  assert.equal(nearestIndex([7], 3), 0);
  assert.equal(nearestIndex([], 3), -1);
});

test("monotonePath passes through points and never overshoots", () => {
  const pts = [
    { x: 0, y: 100 },
    { x: 10, y: 20 },
    { x: 20, y: 20 },
    { x: 30, y: 90 },
  ];
  const d = monotonePath(pts);
  assert.ok(d.startsWith("M 0 100 C"));
  assert.ok(d.endsWith("30 90"));
  const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  const ys = nums.filter((_, i) => i % 2 === 1);
  assert.ok(Math.min(...ys) >= 20 && Math.max(...ys) <= 100);
  assert.equal(monotonePath([{ x: 1, y: 2 }]), "M 1 2");
  assert.equal(monotonePath([{ x: 1, y: 2 }, { x: 3, y: 4 }]), "M 1 2 L 3 4");
  assert.equal(monotonePath([]), "");
});

test("areaPath closes to the baseline", () => {
  const d = areaPath([{ x: 0, y: 10 }, { x: 10, y: 20 }], 50);
  assert.ok(d.endsWith("L 10 50 L 0 50 Z"));
  assert.equal(areaPath([{ x: 0, y: 10 }], 50), "");
});

test("clampBox keeps a tooltip inside the chart", () => {
  assert.equal(clampBox(5, 100, 300), 0);
  assert.equal(clampBox(150, 100, 300), 100);
  assert.equal(clampBox(295, 100, 300), 200);
  assert.equal(clampBox(5, 100, 300, 4), 4);
  assert.equal(clampBox(295, 100, 300, 4), 196);
  assert.equal(clampBox(10, 400, 300), 0);
});
