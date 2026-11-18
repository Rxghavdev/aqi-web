/**
 * Pure helpers for the history chart: day merging, scales, ticks, curve paths
 * and nearest-day lookup. No DOM, no React, so they can be unit tested.
 */

export type DayKind = "official" | "estimate";

export type RawPoint = { date: string; aqi: number };

export type Day = {
  date: string;
  /** UTC midnight of the date, in ms. */
  t: number;
  aqi: number;
  kind: DayKind;
};

export type Run = { kind: DayKind; start: number; end: number };

export type Xy = { x: number; y: number };

const DAY_MS = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** CPCB band thresholds that are worth a gridline. */
export const BAND_EDGES = [50, 100, 200, 300, 400] as const;

export function parseDay(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const t = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isFinite(t) ? t : null;
}

/** "18 Nov" */
export function formatShort(date: string): string {
  const t = parseDay(date);
  if (t == null) return date;
  const d = new Date(t);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "Tue 18 Nov" */
export function formatLong(date: string): string {
  const t = parseDay(date);
  if (t == null) return date;
  const d = new Date(t);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function clean(points: RawPoint[], kind: DayKind): Day[] {
  const days: Day[] = [];
  for (const point of points) {
    const t = parseDay(point.date);
    if (t == null || !Number.isFinite(point.aqi)) continue;
    days.push({ date: point.date, t, aqi: Math.round(point.aqi), kind });
  }
  return days;
}

/**
 * One value per day. An official reading always wins over an estimate for the
 * same day; estimates only fill days that have no official reading.
 */
export function mergeDays(official: RawPoint[], model: RawPoint[]): Day[] {
  const byDate = new Map<string, Day>();
  for (const day of clean(model, "estimate")) byDate.set(day.date, day);
  for (const day of clean(official, "official")) byDate.set(day.date, day);
  return [...byDate.values()].sort((a, b) => a.t - b.t);
}

/** Contiguous stretches of the same kind, as inclusive index ranges. */
export function splitRuns(days: Day[]): Run[] {
  const runs: Run[] = [];
  for (let index = 0; index < days.length; index += 1) {
    const last = runs[runs.length - 1];
    if (last && last.kind === days[index].kind) last.end = index;
    else runs.push({ kind: days[index].kind, start: index, end: index });
  }
  return runs;
}

export type Summary = {
  latest: Day | null;
  highest: Day | null;
  lowest: Day | null;
};

/** Latest prefers the newest official reading; extremes cover every visible day. */
export function summarize(days: Day[]): Summary {
  if (days.length === 0) return { latest: null, highest: null, lowest: null };
  let latest: Day | null = null;
  for (const day of days) if (day.kind === "official") latest = day;
  latest ??= days[days.length - 1];
  let highest = days[0];
  let lowest = days[0];
  for (const day of days) {
    if (day.aqi >= highest.aqi) highest = day;
    if (day.aqi <= lowest.aqi) lowest = day;
  }
  return { latest, highest, lowest };
}

/** Value domain snapped to 50s, never narrower than 100 and never outside 0–500. */
export function yDomain(values: number[]): { lo: number; hi: number } {
  if (values.length === 0) return { lo: 0, hi: 200 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  let lo = Math.max(0, Math.floor((min - 12) / 50) * 50);
  let hi = Math.min(500, Math.ceil((max + 12) / 50) * 50);
  if (hi - lo < 100) {
    if (lo + 100 <= 500) hi = lo + 100;
    else lo = hi - 100;
  }
  return { lo, hi };
}

/** Y-axis tick values: every 50 on a tight domain, CPCB band edges on a wide one. */
export function yTicks(lo: number, hi: number, plotH: number, minGap = 22): number[] {
  const span = hi - lo;
  const candidates: number[] = [];
  if (span <= 250) {
    for (let v = Math.ceil(lo / 50) * 50; v <= hi; v += 50) candidates.push(v);
  } else {
    for (const v of BAND_EDGES) if (v >= lo && v <= hi) candidates.push(v);
  }
  const pxPer = plotH / (span || 1);
  const kept: number[] = [];
  // Walk from the top so the busiest, most severe edges survive crowding.
  for (const value of [...candidates].reverse()) {
    const last = kept[kept.length - 1];
    if (last == null || (last - value) * pxPer >= minGap) kept.push(value);
  }
  return kept.reverse();
}

export function linearScale(
  d0: number,
  d1: number,
  r0: number,
  r1: number,
): (value: number) => number {
  const span = d1 - d0;
  if (span === 0) return () => (r0 + r1) / 2;
  return (value) => r0 + ((value - d0) / span) * (r1 - r0);
}

/** Time window for x. A short history is padded back so it does not stretch. */
export function timeDomain(days: Day[], minDays = 6): { min: number; max: number } {
  const first = days[0]?.t ?? 0;
  const last = days[days.length - 1]?.t ?? first;
  return { min: Math.min(first, last - minDays * DAY_MS), max: last };
}

/** Evenly spaced whole-day tick times across the domain. */
export function xTicks(min: number, max: number, count: number): number[] {
  const days = Math.round((max - min) / DAY_MS);
  if (days <= 0) return [max];
  const n = Math.max(2, Math.min(count, days + 1));
  const ticks: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const t = min + Math.round((days * i) / (n - 1)) * DAY_MS;
    if (ticks[ticks.length - 1] !== t) ticks.push(t);
  }
  return ticks;
}

export function dateFromT(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/** Index of the entry in a sorted list of x positions closest to x. */
export function nearestIndex(xs: number[], x: number): number {
  if (xs.length === 0) return -1;
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  return Math.abs(xs[lo] - x) <= Math.abs(xs[hi] - x) ? lo : hi;
}

const r1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Monotone cubic (Fritsch–Carlson) path through the points. The curve never
 * overshoots a data value, so a smooth line cannot invent a spike or a dip.
 */
export function monotonePath(points: Xy[]): string {
  const n = points.length;
  if (n === 0) return "";
  const move = `M ${r1(points[0].x)} ${r1(points[0].y)}`;
  if (n === 1) return move;
  if (n === 2) return `${move} L ${r1(points[1].x)} ${r1(points[1].y)}`;

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const w = points[i + 1].x - points[i].x;
    dx.push(w);
    slope.push(w === 0 ? 0 : (points[i + 1].y - points[i].y) / w);
  }
  const tangent: number[] = new Array(n).fill(0);
  tangent[0] = slope[0];
  tangent[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i += 1) {
    const a = slope[i - 1];
    const b = slope[i];
    if (a * b <= 0) tangent[i] = 0;
    else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      tangent[i] = (w1 + w2) / (w1 / a + w2 / b);
    }
  }

  let d = move;
  for (let i = 0; i < n - 1; i += 1) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const h = dx[i] / 3;
    d +=
      ` C ${r1(p0.x + h)} ${r1(p0.y + tangent[i] * h)}` +
      ` ${r1(p1.x - h)} ${r1(p1.y - tangent[i + 1] * h)}` +
      ` ${r1(p1.x)} ${r1(p1.y)}`;
  }
  return d;
}

/** Closed area between a monotone line and a baseline. */
export function areaPath(points: Xy[], baseline: number): string {
  if (points.length < 2) return "";
  const first = points[0];
  const last = points[points.length - 1];
  return `${monotonePath(points)} L ${r1(last.x)} ${r1(baseline)} L ${r1(first.x)} ${r1(baseline)} Z`;
}

/** Keep a floating box of the given width inside [0, limit]. */
export function clampBox(center: number, width: number, limit: number, gap = 0): number {
  const max = Math.max(gap, limit - width - gap);
  return Math.min(max, Math.max(gap, center - width / 2));
}
