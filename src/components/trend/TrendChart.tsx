"use client";

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { bandAccent, bandFor, bandNumberColor, bandTextColor } from "@/lib/aqi";
import {
  BAND_EDGES,
  areaPath,
  clampBox,
  dateFromT,
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
  type Day,
  type RawPoint,
  type Xy,
} from "./geometry.ts";

type Range = "1m" | "6m";
type Result =
  | { key: string; status: "ready"; range: Range; official: RawPoint[]; model: RawPoint[] }
  | { key: string; status: "error" };

const RANGE_LABEL: Record<Range, string> = { "1m": "last 30 days", "6m": "last 6 months" };

/**
 * Interactive history chart. `accent` is accepted for backwards compatibility
 * with older call sites; colours now come from each reading's own CPCB band.
 */
export function TrendChart({
  kind,
  slug,
}: {
  kind: "city" | "station";
  slug: string;
  accent?: string;
}) {
  const headingId = useId();
  const [range, setRange] = useState<Range>("1m");
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const key = `${kind}:${slug}:${range}:${attempt}`;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ kind, slug, range });
    fetch(`/api/trend?${params.toString()}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("trend");
        const data: unknown = await response.json();
        setResult({
          key,
          status: "ready",
          range,
          official: readSeries(data, "official"),
          model: readSeries(data, "model"),
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
          return;
        }
        setResult({ key, status: "error" });
      });
    return () => controller.abort();
  }, [kind, slug, range, key]);

  const loading = result == null || result.key !== key;
  // While a new range loads, the previous chart stays on screen, dimmed.
  const shown = result?.status === "ready" ? result : null;
  const failed = !loading && result?.status === "error";

  const days = useMemo(
    () => (shown ? mergeDays(shown.official, shown.model) : []),
    [shown],
  );
  const officialCount = useMemo(() => days.filter((d) => d.kind === "official").length, [days]);
  const estimateCount = days.length - officialCount;
  const summary = useMemo(() => summarize(days), [days]);
  const empty = !loading && shown != null && days.length === 0;
  const firstOfficial = days.find((d) => d.kind === "official") ?? null;

  const body = (() => {
    if (failed) {
      return (
        <Notice
          title="History is not loading right now"
          text="Check your connection and try again."
          onRetry={() => setAttempt((n) => n + 1)}
        />
      );
    }
    if (empty) {
      return (
        <Notice
          title="No history yet"
          text="Daily readings will appear here once we have recorded a few."
          onRetry={() => setAttempt((n) => n + 1)}
        />
      );
    }
    if (shown == null) return <div className="trend-plot trend-plot-skeleton" aria-hidden="true" />;
    return (
      <Plot
        days={days}
        rangeLabel={RANGE_LABEL[shown.range]}
        dataKey={result?.key ?? ""}
        busy={loading}
      />
    );
  })();

  return (
    <section className="trend-card" aria-busy={loading || undefined} aria-labelledby={headingId}>
      <div className="trend-head">
        <div className="trend-titles">
          <h2 className="trend-title" id={headingId}>
            History
          </h2>
          <p className="trend-sub">Daily AQI, {RANGE_LABEL[range]}</p>
        </div>
        <RangeSwitch range={range} onChange={setRange} />
      </div>

      <Stats summary={summary} count={days.length} skeleton={loading && shown == null} />

      {body}

      {shown && days.length > 0 && !failed ? (
        <div className="trend-foot">
          <ul className="trend-legend" aria-label="Legend">
            {officialCount > 0 ? (
              <li>
                <span className="trend-swatch trend-swatch-official" aria-hidden="true" />
                Official
              </li>
            ) : null}
            {estimateCount > 0 ? (
              <li>
                <span className="trend-swatch trend-swatch-estimate" aria-hidden="true" />
                Estimate
              </li>
            ) : null}
          </ul>
          {officialCount > 0 && officialCount < 7 && firstOfficial ? (
            <p className="trend-note">
              Recording since {formatShort(firstOfficial.date)}. The official line fills in day by
              day.
            </p>
          ) : null}
          {estimateCount > 0 ? (
            <p className="trend-caption">
              Estimates come from an atmospheric model and fill the gaps before our own records
              begin.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/* Range switch ----------------------------------------------------------- */

function RangeSwitch({ range, onChange }: { range: Range; onChange: (next: Range) => void }) {
  return (
    <div className="trend-switch" role="group" aria-label="Chart range" data-range={range}>
      <span className="trend-thumb" aria-hidden="true" />
      <button
        type="button"
        aria-pressed={range === "1m"}
        aria-label="Last 30 days"
        onClick={() => onChange("1m")}
      >
        1M
      </button>
      <button
        type="button"
        aria-pressed={range === "6m"}
        aria-label="Last 6 months"
        onClick={() => onChange("6m")}
      >
        6M
      </button>
    </div>
  );
}

/* Stat tiles -------------------------------------------------------------- */

function Stats({
  summary,
  count,
  skeleton,
}: {
  summary: ReturnType<typeof summarize>;
  count: number;
  skeleton: boolean;
}) {
  const tiles: { label: string; day: Day | null }[] = [
    { label: "Latest", day: summary.latest },
    { label: "Highest", day: count > 1 ? summary.highest : null },
    { label: "Lowest", day: count > 1 ? summary.lowest : null },
  ];
  return (
    <dl className="trend-stats">
      {tiles.map(({ label, day }) => {
        const band = day ? bandFor(day.aqi) : null;
        return (
          <div key={label} className="trend-stat" data-empty={day == null || undefined}>
            <dt>{label}</dt>
            {skeleton ? (
              <dd className="trend-stat-skeleton" aria-hidden="true" />
            ) : (
              <dd>
                <span className="trend-stat-value" style={{ color: day ? bandNumberColor(band) : undefined }}>
                  {day ? day.aqi : "–"}
                </span>
                {day ? (
                  <>
                    <span className="trend-stat-band" style={{ color: bandTextColor(band) }}>
                      {band}
                    </span>
                    <span className="trend-stat-date">
                      {formatShort(day.date)}
                      <span className="trend-tag" data-kind={day.kind}>
                        {day.kind === "official" ? "Official" : "Estimate"}
                      </span>
                    </span>
                  </>
                ) : (
                  <span className="trend-stat-date">&nbsp;</span>
                )}
              </dd>
            )}
          </div>
        );
      })}
    </dl>
  );
}

/* Empty and error states ---------------------------------------------------- */

function Notice({ title, text, onRetry }: { title: string; text: string; onRetry: () => void }) {
  return (
    <div className="trend-plot trend-notice" role="status">
      <p className="trend-notice-title">{title}</p>
      <p className="trend-notice-text">{text}</p>
      <button type="button" className="trend-retry" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

/* Plot -------------------------------------------------------------------- */

type Geometry = {
  w: number;
  h: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  pts: Xy[];
  xs: number[];
  lo: number;
  hi: number;
  yOf: (value: number) => number;
  ticks: { value: number; y: number }[];
  edges: number[];
  bands: { y0: number; y1: number; color: string }[];
  stops: { offset: number; color: string }[];
  runs: { kind: Day["kind"]; line: string; area: string }[];
  xLabels: { x: number; label: string; anchor: "start" | "middle" | "end" }[];
  dotKinds: { official: boolean; estimate: boolean };
};

const PAD = { left: 36, right: 14, top: 14, bottom: 26 };
const BAND_BOUNDS = [0, 50, 100, 200, 300, 400, 500];

function buildGeometry(days: Day[], w: number, h: number): Geometry {
  const left = PAD.left;
  const right = w - PAD.right;
  const top = PAD.top;
  const bottom = h - PAD.bottom;
  const { lo, hi } = yDomain(days.map((d) => d.aqi));
  const yOf = linearScale(lo, hi, bottom, top);
  const time = timeDomain(days);
  const xOf = linearScale(time.min, time.max, left, right);
  const pts = days.map((d) => ({ x: xOf(d.t), y: yOf(d.aqi) }));
  const xs = pts.map((p) => p.x);

  const ticks = yTicks(lo, hi, bottom - top).map((value) => ({ value, y: yOf(value) }));
  const edges = BAND_EDGES.filter((v) => v > lo && v < hi);

  const bands: Geometry["bands"] = [];
  const stops: Geometry["stops"] = [];
  for (let i = BAND_BOUNDS.length - 2; i >= 0; i -= 1) {
    const a = Math.max(BAND_BOUNDS[i], lo);
    const b = Math.min(BAND_BOUNDS[i + 1], hi);
    if (a >= b) continue;
    const color = bandAccent(bandFor((a + b) / 2));
    bands.push({ y0: yOf(b), y1: yOf(a), color });
    stops.push({ offset: (hi - (a + b) / 2) / (hi - lo), color });
  }

  const runs: Geometry["runs"] = [];
  for (const run of splitRuns(days)) {
    // An estimate stretch reaches out to its official neighbours so the line is continuous.
    const from = run.kind === "estimate" ? Math.max(0, run.start - 1) : run.start;
    const to = run.kind === "estimate" ? Math.min(days.length - 1, run.end + 1) : run.end;
    const slice = pts.slice(from, to + 1);
    if (slice.length < 2) continue;
    runs.push({ kind: run.kind, line: monotonePath(slice), area: areaPath(slice, bottom) });
  }

  const plotW = right - left;
  const tickCount = Math.max(2, Math.min(6, Math.floor(plotW / 84)));
  const xt = xTicks(time.min, time.max, tickCount);
  const xLabels = xt.map((t, i) => ({
    x: xOf(t),
    label: formatShort(dateFromT(t)),
    anchor: (i === 0 ? "start" : i === xt.length - 1 ? "end" : "middle") as
      | "start"
      | "middle"
      | "end",
  }));

  const spacing = days.length > 1 ? plotW / (days.length - 1) : plotW;
  const roomy = spacing >= 9;
  return {
    w,
    h,
    left,
    right,
    top,
    bottom,
    pts,
    xs,
    lo,
    hi,
    yOf,
    ticks,
    edges,
    bands,
    stops,
    runs,
    xLabels,
    dotKinds: { official: roomy, estimate: roomy },
  };
}

function summaryLabel(days: Day[], rangeLabel: string): string {
  const s = summarize(days);
  if (!s.latest || !s.highest || !s.lowest) return `AQI history, ${rangeLabel}. No data.`;
  const estimates = days.filter((d) => d.kind === "estimate").length;
  const latestKind = s.latest.kind === "official" ? "official reading" : "estimate";
  const parts = [
    `AQI history, ${rangeLabel}, ${days.length} ${days.length === 1 ? "day" : "days"}.`,
    `Latest ${latestKind} ${s.latest.aqi}, ${bandFor(s.latest.aqi)}, on ${formatShort(s.latest.date)}.`,
  ];
  if (days.length > 1) {
    parts.push(`Highest ${s.highest.aqi} on ${formatShort(s.highest.date)}.`);
    parts.push(`Lowest ${s.lowest.aqi} on ${formatShort(s.lowest.date)}.`);
  }
  if (estimates > 0) {
    parts.push(
      estimates === days.length
        ? "All values are estimates."
        : `${estimates} of the days are estimates; the rest are official.`,
    );
  }
  parts.push("Focus the chart and use the arrow keys to read each day.");
  return parts.join(" ");
}

function dayReadout(day: Day): string {
  return `${formatLong(day.date)}: AQI ${day.aqi}, ${bandFor(day.aqi)}, ${
    day.kind === "official" ? "official reading" : "estimate"
  }.`;
}

function Plot({
  days,
  rangeLabel,
  dataKey,
  busy,
}: {
  days: Day[];
  rangeLabel: string;
  dataKey: string;
  busy: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const frame = useRef(0);
  const lastX = useRef(0);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [active, setActive] = useState<number | null>(null);
  const [announce, setAnnounce] = useState("");
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const geo = useMemo(
    () => (size.w > 0 && size.h > 0 && days.length > 0 ? buildGeometry(days, size.w, size.h) : null),
    [days, size.w, size.h],
  );
  const label = useMemo(() => summaryLabel(days, rangeLabel), [days, rangeLabel]);

  // A fresh data set starts with no cursor.
  const [seenKey, setSeenKey] = useState(dataKey);
  if (seenKey !== dataKey) {
    setSeenKey(dataKey);
    setActive(null);
  }
  const index = active != null && active < days.length ? active : null;
  const day = index != null ? days[index] : null;

  // Dismiss a touch selection with a tap anywhere else.
  useEffect(() => {
    if (index == null) return;
    const away = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setActive(null);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [index]);

  // Place the tooltip: centred on the day, kept inside the chart, flipped below near the top.
  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!tip || !geo || index == null) return;
    const point = geo.pts[index];
    const tipW = tip.offsetWidth;
    const tipH = tip.offsetHeight;
    const x = clampBox(point.x, tipW, geo.w, 4);
    let y = point.y - tipH - 16;
    if (y < 2) y = Math.min(point.y + 18, geo.h - tipH - 2);
    tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }, [geo, index, day]);

  const pick = useCallback(
    (clientX: number) => {
      lastX.current = clientX;
      if (frame.current || !geo) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        const rect = wrapRef.current?.getBoundingClientRect();
        if (!rect || !geo) return;
        const next = nearestIndex(geo.xs, lastX.current - rect.left);
        if (next >= 0) setActive(next);
      });
    },
    [geo],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") event.currentTarget.setPointerCapture(event.pointerId);
    pick(event.clientX);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => pick(event.clientX);
  const onPointerLeave = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    if (event.currentTarget.matches(":focus-visible")) return;
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    setActive(null);
  };

  const move = (next: number) => {
    const clamped = Math.max(0, Math.min(days.length - 1, next));
    setActive(clamped);
    setAnnounce(dayReadout(days[clamped]));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (days.length === 0) return;
    const current = index ?? days.length - 1;
    switch (event.key) {
      case "ArrowLeft":
        move(index == null ? current : current - 1);
        break;
      case "ArrowRight":
        move(index == null ? current : current + 1);
        break;
      case "Home":
        move(0);
        break;
      case "End":
        move(days.length - 1);
        break;
      case "Escape":
        setActive(null);
        setAnnounce("");
        return;
      default:
        return;
    }
    event.preventDefault();
  };
  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.matches(":focus-visible") || days.length === 0) return;
    move(days.length - 1);
  };
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setActive(null);
    setAnnounce("");
  };

  const band = day ? bandFor(day.aqi) : null;

  return (
    <div
      ref={wrapRef}
      className="trend-plot"
      data-busy={busy || undefined}
      data-active={index != null || undefined}
      role="group"
      aria-label="Chart. Use the left and right arrow keys to move between days."
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {geo ? (
        <>
          <svg
            className="trend-svg"
            width={geo.w}
            height={geo.h}
            viewBox={`0 0 ${geo.w} ${geo.h}`}
            role="img"
            aria-label={label}
          >
            <Layers geo={geo} days={days} uid={uid} dataKey={dataKey} />
            {index != null && day ? <Cursor geo={geo} day={day} index={index} /> : null}
          </svg>
          <div
            ref={tipRef}
            className="trend-tip"
            data-show={index != null || undefined}
            aria-hidden="true"
          >
            {day ? (
              <>
                <div className="trend-tip-top">
                  <span className="trend-tip-date">{formatLong(day.date)}</span>
                  <span className="trend-tag" data-kind={day.kind}>
                    {day.kind === "official" ? "Official" : "Estimate"}
                  </span>
                </div>
                <div className="trend-tip-main">
                  <span className="trend-tip-value" style={{ color: bandTextColor(band) }}>
                    {day.aqi}
                  </span>
                  <span className="trend-tip-band" style={{ color: bandTextColor(band) }}>
                    {band}
                  </span>
                </div>
              </>
            ) : null}
          </div>
        </>
      ) : null}
      <p className="trend-sr" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}

/* Static layers: memoised, so moving the cursor never re-renders the SVG body. */

const Layers = memo(function Layers({
  geo,
  days,
  uid,
  dataKey,
}: {
  geo: Geometry;
  days: Day[];
  uid: string;
  dataKey: string;
}) {
  const lineId = `${uid}-line`;
  const fadeId = `${uid}-fade`;
  const maskId = `${uid}-mask`;
  const last = days.length - 1;
  const latestOfficial = (() => {
    for (let i = days.length - 1; i >= 0; i -= 1) if (days[i].kind === "official") return i;
    return last;
  })();

  return (
    <g>
      <defs>
        <linearGradient
          id={lineId}
          gradientUnits="userSpaceOnUse"
          x1="0"
          x2="0"
          y1={geo.top}
          y2={geo.bottom}
        >
          {geo.stops.map((stop) => (
            <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
          ))}
        </linearGradient>
        <linearGradient id={fadeId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={maskId} maskContentUnits="objectBoundingBox">
          <rect x="0" y="0" width="1" height="1" fill={`url(#${fadeId})`} />
        </mask>
      </defs>

      {/* CPCB bands, faint */}
      {geo.bands.map((band) => (
        <rect
          key={band.color + band.y0}
          x={geo.left}
          y={band.y0}
          width={geo.right - geo.left}
          height={band.y1 - band.y0}
          fill={band.color}
          className="trend-band"
        />
      ))}
      {geo.edges.map((value) => (
        <line
          key={value}
          x1={geo.left}
          x2={geo.right}
          y1={geo.yOf(value)}
          y2={geo.yOf(value)}
          className="trend-grid"
        />
      ))}
      {geo.ticks.map((tick) => (
        <text key={tick.value} x={geo.left - 8} y={tick.y} className="trend-axis" textAnchor="end" dy="0.34em">
          {tick.value}
        </text>
      ))}
      {geo.xLabels.map((tick) => (
        <text
          key={tick.x}
          x={tick.x}
          y={geo.h - 6}
          className="trend-axis"
          textAnchor={tick.anchor}
        >
          {tick.label}
        </text>
      ))}

      {/* Lines, areas and dots reveal once, left to right. */}
      <g key={dataKey} className="trend-reveal">
        {geo.runs.map((run, i) => (
          <path
            key={`a${i}`}
            d={run.area}
            fill={`url(#${lineId})`}
            mask={`url(#${maskId})`}
            className="trend-area"
            data-kind={run.kind}
          />
        ))}
        {geo.runs.map((run, i) => (
          <path
            key={`l${i}`}
            d={run.line}
            fill="none"
            stroke={`url(#${lineId})`}
            className="trend-line"
            data-kind={run.kind}
          />
        ))}
        {days.map((day, i) => {
          const dots = day.kind === "official" ? geo.dotKinds.official : geo.dotKinds.estimate;
          if (!dots && i !== latestOfficial) return null;
          const point = geo.pts[i];
          const color = bandAccent(bandFor(day.aqi));
          if (i === latestOfficial) {
            return (
              <g key={day.date}>
                <circle cx={point.x} cy={point.y} r={9} fill={color} className="trend-halo" />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={5}
                  className={day.kind === "official" ? "trend-dot" : "trend-dot-hollow"}
                  style={day.kind === "official" ? { fill: color } : { stroke: color }}
                />
              </g>
            );
          }
          return day.kind === "official" ? (
            <circle key={day.date} cx={point.x} cy={point.y} r={3.5} className="trend-dot" style={{ fill: color }} />
          ) : (
            <circle
              key={day.date}
              cx={point.x}
              cy={point.y}
              r={2.75}
              className="trend-dot-hollow"
              style={{ stroke: color }}
            />
          );
        })}
      </g>
    </g>
  );
});

/* Cursor layer: crosshair and highlight dot. Tiny, re-rendered per day change. */

const Cursor = memo(function Cursor({
  geo,
  day,
  index,
}: {
  geo: Geometry;
  day: Day;
  index: number;
}) {
  const point = geo.pts[index];
  const color = bandAccent(bandFor(day.aqi));
  return (
    <g className="trend-cursor" pointerEvents="none">
      <line x1={point.x} x2={point.x} y1={geo.top} y2={geo.bottom} className="trend-crosshair" />
      <circle cx={point.x} cy={point.y} r={11} fill={color} className="trend-cursor-halo" />
      {day.kind === "official" ? (
        <circle cx={point.x} cy={point.y} r={5.5} className="trend-cursor-dot" style={{ fill: color }} />
      ) : (
        <circle
          cx={point.x}
          cy={point.y}
          r={5}
          className="trend-cursor-dot trend-cursor-dot-hollow"
          style={{ stroke: color }}
        />
      )}
    </g>
  );
});

/* Data ---------------------------------------------------------------------- */

function readSeries(data: unknown, key: "official" | "model"): RawPoint[] {
  if (!data || typeof data !== "object") return [];
  const rows = (data as Record<string, unknown>)[key];
  if (!Array.isArray(rows)) return [];
  const points: RawPoint[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const date = (row as { date?: unknown }).date;
    const aqi = (row as { aqi?: unknown }).aqi;
    if (typeof date !== "string" || date.length === 0) continue;
    if (typeof aqi !== "number" || !Number.isFinite(aqi)) continue;
    points.push({ date, aqi });
  }
  return points;
}
